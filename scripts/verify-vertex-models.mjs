// Reusable Vertex AI model probe.
//
// Purpose: definitively answer "which Gemini model IDs can OUR project actually
// call right now?" — without guessing from docs (GA/preview status churns) and
// without touching the app or any user data. Re-run this whenever Google rotates
// models.
//
// It reads the same service-account credential the app uses, mints an access
// token with the same JWT flow as server/ai/adapters/vertexAi.js, and makes one
// tiny generateContent call per candidate model at the same endpoint/location
// the app uses (global). It prints OK / FAILED per model so you know exactly
// which IDs are safe to put in the app.
//
// Usage (from the repo root):
//   node scripts/verify-vertex-models.mjs
//   node scripts/verify-vertex-models.mjs gemini-3-flash gemini-3-pro
//
// Notes:
//   - Makes a few small billed API calls against your project. Cost is trivial.
//   - Read-only with respect to the app: it does not modify runtime-state.json,
//     credentials, cases, or sources.

import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CREDENTIAL_PATH = path.join(os.homedir(), "DawahDeskData", "vertex-service-account.json");
// Location defaults to "global" (matches the app's Vertex provider config).
// Override to probe regional availability, e.g. VERTEX_LOCATION=us-central1.
const LOCATION = process.env.VERTEX_LOCATION || "global";
const BASE_URL =
  LOCATION === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${LOCATION}-aiplatform.googleapis.com`;

// Default candidates: the new Gemini 3 family plus the IDs currently in the app,
// so the report also shows which existing models still work (don't remove a
// working model until its replacement is confirmed).
const DEFAULT_CANDIDATES = [
  // New Gemini 3 family (migration targets)
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3-1-pro",
  "gemini-3-1-flash-lite",
  // Currently configured in the app (for comparison)
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
];

const encodeBase64Url = (value) =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const loadCredentials = async () => {
  let raw;
  try {
    raw = await readFile(CREDENTIAL_PATH, "utf8");
  } catch {
    throw new Error(`Could not read credential file at:\n  ${CREDENTIAL_PATH}\nMake sure Da'wah Desk credentials are set up.`);
  }
  const credentials = JSON.parse(raw);
  if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
    throw new Error("Credential file is missing client_email, private_key, or project_id.");
  }
  return credentials;
};

const getAccessToken = async (credentials) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${encodeBase64Url(signer.sign(credentials.private_key))}`;

  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()).access_token;
};

const probeModel = async (accessToken, projectId, modelId) => {
  const url = `${BASE_URL}/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${modelId}:generateContent`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
      }),
    });
    if (response.ok) {
      return { modelId, ok: true, detail: "200 OK" };
    }
    const body = (await response.text()).replace(/\s+/g, " ").trim();
    return { modelId, ok: false, detail: `${response.status} ${body.slice(0, 500)}` };
  } catch (error) {
    return { modelId, ok: false, detail: error.message };
  }
};

const main = async () => {
  const candidates = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CANDIDATES;

  const credentials = await loadCredentials();
  console.log(`Project:  ${credentials.project_id}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Testing ${candidates.length} model id(s)...\n`);

  const accessToken = await getAccessToken(credentials);

  const results = [];
  for (const modelId of candidates) {
    const result = await probeModel(accessToken, credentials.project_id, modelId);
    results.push(result);
    console.log(`${result.ok ? "  OK    " : "  FAILED"}  ${modelId}${result.ok ? "" : `  ->  ${result.detail}`}`);
  }

  const working = results.filter((r) => r.ok).map((r) => r.modelId);
  console.log(`\nWorking models for ${credentials.project_id}:`);
  console.log(working.length ? `  ${working.join("\n  ")}` : "  (none — check project access / billing)");
};

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
