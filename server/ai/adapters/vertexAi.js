import crypto from "node:crypto";
import fs from "node:fs/promises";

const encodeBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getCredentialPath = (provider) => {
  if (!provider.apiKeyRef) {
    throw new Error(`No credential path reference configured for ${provider.name}.`);
  }

  const credentialPath = process.env[provider.apiKeyRef];
  if (!credentialPath) {
    throw new Error(`Missing environment variable for ${provider.apiKeyRef}.`);
  }

  return credentialPath;
};

const getProjectId = (provider, credentials) => {
  const projectId = provider.projectId || credentials.project_id;
  if (!projectId) {
    throw new Error(`No project ID configured for ${provider.name}.`);
  }
  return projectId;
};

const getLocation = (provider) => provider.location || "global";

const loadCredentials = async (provider) => {
  const credentialPath = getCredentialPath(provider);
  const raw = await fs.readFile(credentialPath, "utf8");
  const credentials = JSON.parse(raw);

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(`Credential file for ${provider.name} is missing service account fields.`);
  }

  return credentials;
};

const getAccessToken = async (provider) => {
  const credentials = await loadCredentials(provider);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const assertion = `${unsignedToken}.${encodeBase64Url(signature)}`;

  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vertex OAuth failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    credentials,
  };
};

const extractText = (data) =>
  data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim?.() ?? "";

const buildGenerateContentUrl = (provider, credentials, modelId) => {
  const projectId = getProjectId(provider, credentials);
  const location = getLocation(provider);
  const baseUrl = provider.baseUrl?.replace(/\/$/, "") || "https://aiplatform.googleapis.com";
  return `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
};

export const createVertexAiAdapter = (provider) => ({
  provider,
  async generateStructured({ modelId, systemPrompt, userPrompt, schema }) {
    const { accessToken, credentials } = await getAccessToken(provider);
    const response = await fetch(buildGenerateContentUrl(provider, credentials, modelId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vertex AI request failed: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = extractText(data);
    return JSON.parse(text);
  },
  async generateText({ modelId, systemPrompt, userPrompt }) {
    const { accessToken, credentials } = await getAccessToken(provider);
    const response = await fetch(buildGenerateContentUrl(provider, credentials, modelId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vertex AI request failed: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    return { text: extractText(data) };
  },
  async healthCheck({ modelId } = {}) {
    const selectedModelId =
      modelId || provider.defaultModelId || provider.modelOptions?.find((option) => option.enabled)?.modelId;
    if (!selectedModelId) {
      return { ok: false, message: "No enabled model is configured." };
    }

    await this.generateText({
      modelId: selectedModelId,
      systemPrompt: "You are a health-check assistant.",
      userPrompt: "Reply with the single word OK.",
    });

    return {
      ok: true,
      message: `Provider responded using ${selectedModelId}.`,
    };
  },
});
