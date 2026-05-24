import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const credentialsFile = path.join(os.homedir(), "DawahDeskData", "credentials.json");

const baseSecretNames = [
  "GOOGLE_APPLICATION_CREDENTIALS",
  "VERTEX_AI_SERVICE_ACCOUNT_PATH",
];

export const sanitizeSecretName = (name = "") =>
  String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/^([^A-Z_])/, "_$1")
    .replace(/_+/g, "_");

const readCredentialsFile = async () => {
  try {
    return JSON.parse(await readFile(credentialsFile, "utf8"));
  } catch {
    return {};
  }
};

export const collectSecretSlotNames = (state) => {
  const names = new Set(baseSecretNames);

  for (const provider of state.aiProviders ?? []) {
    if (provider.apiKeyRef) {
      names.add(provider.apiKeyRef);
    }
  }

  for (const connector of state.connectors ?? []) {
    if (connector.apiKeyRef) {
      names.add(connector.apiKeyRef);
    }
    if (connector.params?.clientIdHint) {
      names.add(connector.params.clientIdHint);
    }
  }

  return [...names]
    .map(sanitizeSecretName)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY — migration from secrets/backend.env.local.bat to credentials.json
// Safe to remove once all users have migrated (Phase 4)
// See DawahDesk-ProjectPlan.md Phase 4 cleanup note
// ─────────────────────────────────────────────────────────────────────────────

const legacyBatPrimary = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "secrets",
  "backend.env.local.bat",
);
const legacyBatFallback = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "secrets",
  "backend.env.bat",
);
const setLinePattern = /^\s*set\s+"?([A-Za-z_][A-Za-z0-9_]*)=(.*?)"?\s*$/i;

// Keys read from the bat file that should be silently dropped and never written to credentials.json.
const DROPPED_BAT_KEYS = new Set(["GOOGLE_TRANSLATE_API_KEY"]);

// The only keys from the bat file that belong in credentials.json.
const CREDENTIALS_TO_MIGRATE = new Set(["VERTEX_AI_SERVICE_ACCOUNT_PATH", "GOOGLE_APPLICATION_CREDENTIALS"]);

const readBatFile = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    const values = {};
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(setLinePattern);
      if (!match) continue;
      values[match[1]] = match[2] ?? "";
    }
    return values;
  } catch {
    return {};
  }
};

const migrateBatFileIfNeeded = async () => {
  const activeBat = existsSync(legacyBatPrimary)
    ? legacyBatPrimary
    : existsSync(legacyBatFallback)
      ? legacyBatFallback
      : null;

  if (!activeBat) return;
  if (existsSync(`${activeBat}.migrated`)) return;

  try {
    const parsed = await readBatFile(activeBat);
    const toMigrate = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (DROPPED_BAT_KEYS.has(key)) continue; // Explicitly drop — never write to credentials.json.
      if (!CREDENTIALS_TO_MIGRATE.has(key)) continue;

      // Bat files with setlocal/endlocal re-export variables using %VARNAME% references.
      // If the parsed value looks like an unresolved placeholder, use process.env instead —
      // the launcher has already resolved and injected the real value before Node started.
      const resolved =
        value.startsWith("%") && value.endsWith("%") ? (process.env[key] ?? "") : value;

      if (resolved) toMigrate[key] = resolved;
    }

    // Only write credentials.json if it does not already exist — never overwrite existing setup.
    if (!existsSync(credentialsFile) && Object.keys(toMigrate).length > 0) {
      await mkdir(path.dirname(credentialsFile), { recursive: true });
      await writeFile(credentialsFile, JSON.stringify(toMigrate, null, 2), "utf8");
      console.log("[Da'wah Desk] Vertex AI credentials migrated from secrets file to credentials.json.");
    }

    await rename(activeBat, `${activeBat}.migrated`);
  } catch (err) {
    console.error("[Da'wah Desk] Credentials migration failed — existing data unchanged:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const loadCredentials = async () => {
  await migrateBatFileIfNeeded();
  const credentials = await readCredentialsFile();
  for (const [key, value] of Object.entries(credentials)) {
    if (value) process.env[key] = value;
  }
};

export const listSecrets = async (state) => {
  const values = await readCredentialsFile();
  const names = new Set([...collectSecretSlotNames(state), ...Object.keys(values).map(sanitizeSecretName)]);

  return {
    filePath: credentialsFile,
    loadedFilePath: credentialsFile,
    secrets: [...names]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((name) => ({
        name,
        value: values[name] ?? process.env[name] ?? "",
        configured: Boolean(values[name] || process.env[name]),
      })),
  };
};

export const getCredentialsStatus = async () => {
  return { configured: existsSync(credentialsFile) };
};

export const saveVertexCredentialJson = async (jsonContent) => {
  let parsed;
  try {
    parsed = JSON.parse(jsonContent);
  } catch {
    throw new Error("Credential content is not valid JSON.");
  }

  const required = ["type", "project_id", "private_key", "client_email"];
  const missing = required.filter((field) => !parsed[field]);
  if (missing.length > 0) {
    throw new Error(`Credential file is missing required fields: ${missing.join(", ")}.`);
  }

  const credentialJsonPath = path.join(os.homedir(), "DawahDeskData", "vertex-service-account.json");
  await mkdir(path.dirname(credentialJsonPath), { recursive: true });
  await writeFile(credentialJsonPath, jsonContent, "utf8");

  await writeSecrets({
    VERTEX_AI_SERVICE_ACCOUNT_PATH: credentialJsonPath,
    GOOGLE_APPLICATION_CREDENTIALS: credentialJsonPath,
  });

  return credentialJsonPath;
};

export const writeSecrets = async (updates = {}) => {
  const current = await readCredentialsFile();
  const next = { ...current };

  for (const [rawName, rawValue] of Object.entries(updates)) {
    const name = sanitizeSecretName(rawName);
    if (!name) continue;
    next[name] = String(rawValue ?? "");
    process.env[name] = next[name];
  }

  await mkdir(path.dirname(credentialsFile), { recursive: true });
  await writeFile(credentialsFile, JSON.stringify(next, null, 2), "utf8");
  return listSecrets({ aiProviders: [], connectors: [] });
};
