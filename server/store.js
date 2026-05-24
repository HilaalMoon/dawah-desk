import { copyFile, cp, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAiDefaults, defaultAiProviders, defaultRuntimeState, defaultSessionAiSelections } from "./defaults.js";

const userDataDir = path.join(os.homedir(), "DawahDeskData");
const stateFile = path.join(userDataDir, "runtime-state.json");
const backupsDir = path.join(userDataDir, "backups");
const opsDir = path.join(userDataDir, "ops");
const maxSnapshotBackups = 20;

let writeQueue = Promise.resolve();
let startupLogged = false;

const normalizeParsedState = (parsed = {}) => ({
  ...parsed,
  aiProviders: parsed.aiProviders ?? defaultAiProviders,
  sessionAiSelections: parsed.sessionAiSelections ?? defaultSessionAiSelections,
  settings: {
    ...parsed.settings,
    general: {
      ...defaultRuntimeState.settings.general,
      ...(parsed.settings?.general ?? {}),
    },
    aiDefaults: parsed.settings?.aiDefaults ?? defaultAiDefaults,
  },
});

const readJsonIfExists = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const readSnapshotWithBackupFallback = async () => {
  try {
    return normalizeParsedState(JSON.parse(await readFile(stateFile, "utf8")));
  } catch {
    const backupFiles = (await readdir(backupsDir)).filter((file) => file.endsWith(".json")).sort().reverse();
    for (const file of backupFiles) {
      try {
        return normalizeParsedState(JSON.parse(await readFile(path.join(backupsDir, file), "utf8")));
      } catch {
        // Keep trying older backups.
      }
    }
    return normalizeParsedState(defaultRuntimeState);
  }
};

const uniqueStamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const applyRuntimeOperation = (state, operation) => {
  if (!operation?.type) return state;

  if (operation.type === "case-save") {
    const caseItem = operation.caseItem;
    const bites = operation.bites ?? [];
    if (!caseItem?.caseId) return state;

    return {
      ...state,
      savedCases: [
        ...(state.savedCases ?? []).filter((item) => item.caseId !== caseItem.caseId),
        caseItem,
      ],
      savedBites: [
        ...(state.savedBites ?? []).filter((bite) => bite.caseId !== caseItem.caseId),
        ...bites,
      ],
    };
  }

  if (operation.type === "case-delete") {
    const caseId = operation.caseId;
    if (!caseId) return state;

    const removedBiteIds = new Set(
      (state.savedBites ?? []).filter((bite) => bite.caseId === caseId).map((bite) => bite.biteId),
    );

    return {
      ...state,
      savedCases: (state.savedCases ?? []).filter((item) => item.caseId !== caseId),
      savedBites: (state.savedBites ?? []).filter((bite) => bite.caseId !== caseId),
      sourceRecords: (state.sourceRecords ?? []).map((source) => ({
        ...source,
        linkedBiteIds: (source.linkedBiteIds ?? []).filter((biteId) => !removedBiteIds.has(biteId)),
      })),
    };
  }

  if (operation.type === "source-save") {
    const source = operation.source;
    if (!source?.sourceId) return state;

    return {
      ...state,
      sourceRecords: [
        ...(state.sourceRecords ?? []).filter((record) => record.sourceId !== source.sourceId),
        source,
      ],
    };
  }

  if (operation.type === "source-delete") {
    const sourceId = operation.sourceId;
    if (!sourceId) return state;

    return {
      ...state,
      sourceRecords: (state.sourceRecords ?? []).filter((record) => record.sourceId !== sourceId),
    };
  }

  return state;
};

const pruneBackups = async () => {
  const files = (await readdir(backupsDir)).filter((file) => file.startsWith("runtime-state-") && file.endsWith(".json")).sort();
  const excess = files.slice(0, Math.max(0, files.length - maxSnapshotBackups));
  await Promise.all(
    excess.map(async (file) => {
      try {
        await unlink(path.join(backupsDir, file));
      } catch {
        // Ignore backup pruning failures.
      }
    }),
  );
};

const backupSnapshot = async () => {
  try {
    await copyFile(stateFile, path.join(backupsDir, `runtime-state-${uniqueStamp()}.json`));
    await pruneBackups();
  } catch {
    // Ignore backup failures; main write should still proceed.
  }
};

const writeSnapshot = async (state) => {
  await ensureRuntimeState();
  await backupSnapshot();
  await withRetry(() => writeFile(stateFile, JSON.stringify(state, null, 2), "utf8"));
};

const recordOperation = async (operation) => {
  if (!operation?.type) return;
  await ensureRuntimeState();
  const opFile = path.join(opsDir, `op-${uniqueStamp()}-${operation.type}.json`);
  await writeFile(
    opFile,
    JSON.stringify(
      {
        ...operation,
        recordedAt: operation.recordedAt ?? new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
};

// ─── retry helper — used by writeSnapshot above and migration below ──────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, retries = 3, delayMs = 500) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.warn(`[Da'wah Desk] File write retried due to EBUSY — succeeded on attempt ${attempt}.`);
      }
      return result;
    } catch (err) {
      if (attempt === retries || err.code !== "EBUSY") throw err;
      await sleep(delayMs);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY — migration code for Phase 1 data separation
// Safe to remove once all users have been migrated (Phase 4)
// See DawahDesk-ProjectPlan.md Phase 4 cleanup note
// ─────────────────────────────────────────────────────────────────────────────

const legacyDataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data");
const legacyStateFile = path.join(legacyDataDir, "runtime-state.json");
const legacyOpsDir = path.join(legacyDataDir, "ops");
const legacyBackupsDir = path.join(legacyDataDir, "backups");

const migrateDataIfNeeded = async () => {
  // Skip if migration already completed (marker file present), or nothing to migrate.
  if (existsSync(`${legacyStateFile}.migrated`)) return;
  if (!existsSync(legacyStateFile)) return;

  const hasLegacyOps = existsSync(legacyOpsDir);
  const hasLegacyBackups = existsSync(legacyBackupsDir);

  try {
    await withRetry(() => copyFile(legacyStateFile, stateFile));
    if (hasLegacyOps) await cp(legacyOpsDir, opsDir, { recursive: true });
    if (hasLegacyBackups) await cp(legacyBackupsDir, backupsDir, { recursive: true });

    // Rename originals so we know migration happened without deleting anything.
    await rename(legacyStateFile, `${legacyStateFile}.migrated`);
    if (hasLegacyOps) await rename(legacyOpsDir, `${legacyOpsDir}.migrated`);
    if (hasLegacyBackups) await rename(legacyBackupsDir, `${legacyBackupsDir}.migrated`);

    console.log("[Da'wah Desk] Data migrated to user data folder.");
  } catch (err) {
    console.error("[Da'wah Desk] Migration failed — existing data unchanged:", err.message);
  }
};

// TEMPORARY — one-time cleanup for Phase 2 provider removal
// Removes ai-openai-primary, ai-openai-compatible, ai-gemini-primary from saved
// runtime state. Safe to remove once all users have run this version (Phase 4).
// See DawahDesk-ProjectPlan.md Phase 4 cleanup note

const DELETED_PROVIDER_IDS = new Set(["ai-openai-primary", "ai-openai-compatible", "ai-gemini-primary"]);
const phase2ProviderCleanupMarker = path.join(userDataDir, "phase2-provider-cleanup.migrated");

const removeDeletedProvidersIfNeeded = async () => {
  if (existsSync(phase2ProviderCleanupMarker)) return;

  let rawState;
  try {
    rawState = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    // State file doesn't exist yet — nothing to clean up.
    await writeFile(phase2ProviderCleanupMarker, "", "utf8");
    return;
  }

  const savedProviders = rawState.aiProviders ?? [];
  const hasStaleProviders = savedProviders.some((p) => DELETED_PROVIDER_IDS.has(p.providerId));

  if (hasStaleProviders) {
    const cleaned = {
      ...rawState,
      aiProviders: savedProviders.filter((p) => !DELETED_PROVIDER_IDS.has(p.providerId)),
    };
    await withRetry(() => writeFile(stateFile, JSON.stringify(cleaned, null, 2), "utf8"));
    console.log("[Da'wah Desk] Removed deleted AI providers from saved state (Phase 2 cleanup).");
  }

  await writeFile(phase2ProviderCleanupMarker, "", "utf8");
};

// TEMPORARY — one-time cleanup for Phase 4 Settings Cleanup
// Clears apiKeyRef from conn-quran-primary, conn-hadith-en, and conn-hadith-ar in saved
// runtime state. QF credentials are now bundled server-side; Hadith slots were placeholders.
// Safe to remove once all users have run this version.
// See DawahDesk-ProjectPlan.md Future Maintenance note

const phase4ConnectorCleanupMarker = path.join(userDataDir, "phase4-connector-cleanup.migrated");

const phase4ConnectorCleanupIfNeeded = async () => {
  if (existsSync(phase4ConnectorCleanupMarker)) return;

  let rawState;
  try {
    rawState = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    // State file doesn't exist yet — nothing to clean up.
    await writeFile(phase4ConnectorCleanupMarker, "", "utf8");
    return;
  }

  const savedConnectors = rawState.connectors ?? [];
  const needsCleanup = savedConnectors.some(
    (c) =>
      (c.connectorId === "conn-quran-primary" && (c.apiKeyRef || c.params?.clientIdHint)) ||
      ((c.connectorId === "conn-hadith-en" || c.connectorId === "conn-hadith-ar") && c.apiKeyRef),
  );

  if (needsCleanup) {
    const cleaned = {
      ...rawState,
      connectors: savedConnectors.map((c) => {
        if (c.connectorId === "conn-quran-primary") {
          const { clientIdHint: _removed, ...restParams } = c.params ?? {};
          return { ...c, apiKeyRef: "", params: restParams };
        }
        if (c.connectorId === "conn-hadith-en" || c.connectorId === "conn-hadith-ar") {
          return { ...c, apiKeyRef: "" };
        }
        return c;
      }),
    };
    await withRetry(() => writeFile(stateFile, JSON.stringify(cleaned, null, 2), "utf8"));
    console.log("[Da'wah Desk] Connector credential refs cleaned (Phase 4 cleanup).");
  }

  await writeFile(phase4ConnectorCleanupMarker, "", "utf8");
};

// TEMPORARY — one-time fix for Phase 7 hardcoded project ID bug
// Reads project_id from vertex-service-account.json and updates the vertex-ai provider
// in runtime state if it still carries "hm-so2021" or an empty projectId.
// Safe to remove once all users have migrated.

const phase7ProjectIdFixMarker = path.join(userDataDir, "phase7-project-id-fix.migrated");
const vertexServiceAccountFile = path.join(userDataDir, "vertex-service-account.json");

const phase7ProjectIdFixIfNeeded = async () => {
  if (existsSync(phase7ProjectIdFixMarker)) return;

  let vertexSa;
  try {
    vertexSa = JSON.parse(await readFile(vertexServiceAccountFile, "utf8"));
  } catch {
    // No credential file present — nothing to fix.
    await writeFile(phase7ProjectIdFixMarker, "", "utf8");
    return;
  }

  const projectId = vertexSa.project_id;
  if (!projectId) {
    await writeFile(phase7ProjectIdFixMarker, "", "utf8");
    return;
  }

  let rawState;
  try {
    rawState = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    // State file doesn't exist yet — nothing to fix.
    await writeFile(phase7ProjectIdFixMarker, "", "utf8");
    return;
  }

  const providers = rawState.aiProviders ?? [];
  const needsFix = providers.some(
    (p) => p.providerType === "vertex-ai" && (!p.projectId || p.projectId === "hm-so2021"),
  );

  if (needsFix) {
    const updated = {
      ...rawState,
      aiProviders: providers.map((p) =>
        p.providerType === "vertex-ai" ? { ...p, projectId } : p,
      ),
    };
    await withRetry(() => writeFile(stateFile, JSON.stringify(updated, null, 2), "utf8"));
    console.log("[Da'wah Desk] Vertex AI project ID updated from credential file.");
  }

  await writeFile(phase7ProjectIdFixMarker, "", "utf8");
};

// ─────────────────────────────────────────────────────────────────────────────
// Starter library seeding — runs once on first launch when savedCases is empty.

const starterLibraryFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data", "starter-library.json");
const starterLibraryMarker = path.join(userDataDir, "starter-library-loaded.migrated");

const loadStarterLibraryIfNeeded = async () => {
  if (existsSync(starterLibraryMarker)) return;

  let starter;
  try {
    starter = JSON.parse(await readFile(starterLibraryFile, "utf8"));
  } catch {
    // Starter library file not present or unreadable — skip silently.
    return;
  }

  const starterCases = Array.isArray(starter.savedCases) ? starter.savedCases : [];
  if (starterCases.length === 0) {
    // Empty starter file — mark done so we don't re-check on every startup.
    await writeFile(starterLibraryMarker, "", "utf8");
    return;
  }

  let rawState;
  try {
    rawState = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    rawState = defaultRuntimeState;
  }

  if ((Array.isArray(rawState.savedCases) ? rawState.savedCases : []).length > 0) {
    // User already has cases — do not overwrite their library.
    await writeFile(starterLibraryMarker, "", "utf8");
    return;
  }

  const seeded = {
    ...rawState,
    savedCases: starterCases,
    savedBites: Array.isArray(starter.savedBites) ? starter.savedBites : [],
    sourceRecords: Array.isArray(starter.sourceRecords) ? starter.sourceRecords : [],
  };
  await withRetry(() => writeFile(stateFile, JSON.stringify(seeded, null, 2), "utf8"));
  await writeFile(starterLibraryMarker, "", "utf8");
  console.log("[Da'wah Desk] Starter library loaded.");
};

// ─────────────────────────────────────────────────────────────────────────────

export const clearOpsLog = async () => {
  const opFiles = (await readdir(opsDir)).filter((file) => file.endsWith(".json"));
  await Promise.all(
    opFiles.map(async (file) => {
      try {
        await unlink(path.join(opsDir, file));
      } catch {
        // Ignore individual deletion failures.
      }
    }),
  );
  console.log("[Da'wah Desk] Ops log cleared after library restore.");
};

export const writePreRestoreBackup = async (currentState) => {
  await mkdir(backupsDir, { recursive: true });
  const snapshot = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: "Da'wah Desk 1.2.0 — Auto safety snapshot",
    savedCases: currentState.savedCases ?? [],
    savedBites: currentState.savedBites ?? [],
    sourceRecords: currentState.sourceRecords ?? [],
  };
  await writeFile(
    path.join(backupsDir, `pre-restore-backup-${uniqueStamp()}.json`),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const ensureRuntimeState = async () => {
  await mkdir(userDataDir, { recursive: true });
  await mkdir(backupsDir, { recursive: true });
  await mkdir(opsDir, { recursive: true });
  await migrateDataIfNeeded();
  await removeDeletedProvidersIfNeeded();
  await phase4ConnectorCleanupIfNeeded();
  await phase7ProjectIdFixIfNeeded();
  await loadStarterLibraryIfNeeded();
  try {
    await readFile(stateFile, "utf8");
  } catch {
    await withRetry(() => writeFile(stateFile, JSON.stringify(defaultRuntimeState, null, 2), "utf8"));
  }
  if (!startupLogged) {
    console.log(`[Da'wah Desk] User data folder: ${userDataDir}`);
    startupLogged = true;
  }
};

export const readRuntimeState = async () => {
  await ensureRuntimeState();
  const baseState = await readSnapshotWithBackupFallback();
  const opFiles = (await readdir(opsDir)).filter((file) => file.endsWith(".json")).sort();
  const opStates = await Promise.all(opFiles.map((file) => readJsonIfExists(path.join(opsDir, file), null)));

  return opStates.reduce(
    (current, operation) => normalizeParsedState(applyRuntimeOperation(current, operation)),
    baseState,
  );
};

export const writeRuntimeState = async (state) => {
  writeQueue = writeQueue.then(() => writeSnapshot(state));
  return writeQueue;
};

export const updateRuntimeState = async (mutateState, options = {}) => {
  writeQueue = writeQueue.then(async () => {
    const currentState = await readRuntimeState();
    const nextState = normalizeParsedState(await mutateState(currentState));
    if (options.operation) {
      await recordOperation(options.operation);
    }
    await writeSnapshot(nextState);
    return nextState;
  });

  return writeQueue;
};
