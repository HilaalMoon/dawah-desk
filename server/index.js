import http from "node:http";
import { existsSync } from "node:fs";
import { createAIProviderAdapter } from "./ai/registry.js";
import { createAIService } from "./ai/service.js";
import { readCachedValue, writeCachedValue } from "./cache.js";
import { createConnectorRegistry } from "./connectors.js";
import { listQfTafsirs, listQfTranslations } from "./quranFoundation.js";
import {
  searchSources,
} from "./orchestrator.js";
import { getCredentialsStatus, listSecrets, loadCredentials, saveVertexCredentialJson, writeSecrets } from "./secretsStore.js";
import { clearOpsLog, readRuntimeState, updateRuntimeState, writePreRestoreBackup } from "./store.js";
import { json, notFound, readBody, withTimeout } from "./utils.js";

const port = process.env.DAWAH_DESK_API_PORT || 8788;
const defaultSessionId = "local-session";

const resolveTargetLanguage = (input) => {
  const label = String(input || "").trim() || "English";
  return {
    code: label.toLowerCase() === "english" ? "en" : undefined,
    label,
  };
};

const resolveSourceLanguageCode = (sourceLanguage) => {
  const normalized = String(sourceLanguage || "").trim().toLowerCase();
  if (normalized === "arabic") return "ar";
  if (normalized === "english") return "en";
  return undefined;
};

const stripSequenceSuffix = (value = "") => value.replace(/\s+\(\d+\/\d+\)\s*$/, "").trim();

const randomBiteToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBiteId = (caseId, kind = "restored") => `bite-${caseId}-${kind}-${randomBiteToken()}`;

const normalizeCaseBites = (bites, fallbackKind = "restored") => {
  const seen = new Set();

  return [...(bites ?? [])]
    .sort((a, b) => a.biteOrder - b.biteOrder)
    .map((bite, index) => {
      let nextId = String(bite.biteId ?? "").trim() || createBiteId(bite.caseId, fallbackKind);
      if (seen.has(nextId)) {
        nextId = createBiteId(bite.caseId, fallbackKind);
      }
      seen.add(nextId);
      return {
        ...bite,
        biteId: nextId,
        biteOrder: index + 1,
      };
    });
};

const normalizeCasesAndBites = (savedCases = [], savedBites = []) => {
  const bitesByCase = new Map();
  for (const bite of savedBites ?? []) {
    if (!bitesByCase.has(bite.caseId)) {
      bitesByCase.set(bite.caseId, []);
    }
    bitesByCase.get(bite.caseId).push(bite);
  }

  const normalizedBites = Array.from(bitesByCase.values()).flatMap((caseBites) => normalizeCaseBites(caseBites));
  const biteIdsByCase = new Map();
  for (const bite of normalizedBites) {
    if (!biteIdsByCase.has(bite.caseId)) {
      biteIdsByCase.set(bite.caseId, []);
    }
    biteIdsByCase.get(bite.caseId).push(bite.biteId);
  }

  return {
    savedCases: savedCases.map((caseItem) => ({
      ...caseItem,
      responseBiteIds: biteIdsByCase.get(caseItem.caseId) ?? [],
    })),
    savedBites: normalizedBites,
  };
};

const buildRecoveredSourceRecords = (state) => {
  const existingSources = Array.isArray(state.sourceRecords) ? state.sourceRecords : [];
  const existingIds = new Set(existingSources.map((source) => source.sourceId));
  const casesById = new Map((state.savedCases ?? []).map((caseItem) => [caseItem.caseId, caseItem]));
  const groupedBites = new Map();

  for (const bite of state.savedBites ?? []) {
    for (const sourceId of bite.sourceLinks ?? []) {
      if (!groupedBites.has(sourceId)) {
        groupedBites.set(sourceId, []);
      }
      groupedBites.get(sourceId).push(bite);
    }
  }

  const recovered = Array.from(groupedBites.entries())
    .filter(([sourceId]) => !existingIds.has(sourceId))
    .map(([sourceId, bites]) => {
      const orderedBites = [...bites].sort((a, b) => a.biteOrder - b.biteOrder);
      const firstBite = orderedBites[0];
      const caseItem = casesById.get(firstBite.caseId);
      const inferredSourceType =
        firstBite.sourceCategory === "quran"
          ? "quran"
          : firstBite.sourceCategory === "hadith"
            ? "hadith"
            : firstBite.sourceCategory === "user"
              ? "user-note"
              : "scholarly-note";

      const excerpt =
        firstBite.structuredSourceLayout === "split-source"
          ? firstBite.sourcePrimaryText ?? firstBite.biteText
          : orderedBites.map((bite) => bite.biteText).join("\n\n");

      return {
        sourceId,
        sourceType: inferredSourceType,
        sourceTitle: stripSequenceSuffix(firstBite.biteTitle),
        topic: caseItem?.topic,
        sourceLanguage: firstBite.structuredSourceLayout === "split-source" ? "Arabic" : "English",
        excerpt,
        fullReference: stripSequenceSuffix(firstBite.biteTitle),
        trustLevel:
          firstBite.supportStatus === "direct-source"
            ? "high"
            : firstBite.supportStatus === "weak-support" || firstBite.supportStatus === "missing-support"
              ? "needs-review"
              : "medium",
        translationAvailable: Boolean(firstBite.sourceSecondaryText),
        authenticatedTranslation: firstBite.sourceSecondaryText,
        translationResourceName: firstBite.translationResourceName ?? firstBite.sourceSecondaryLabel,
        tafsirText: firstBite.sourceTafsirText,
        tafsirResourceName: firstBite.tafsirResourceName ?? firstBite.sourceTafsirLabel,
        linkedBiteIds: orderedBites.map((bite) => bite.biteId),
        sourceOrigin:
          inferredSourceType === "quran" || inferredSourceType === "hadith" ? "connector" : "manual",
        connectorId:
          inferredSourceType === "quran"
            ? "conn-quran-primary"
            : inferredSourceType === "hadith"
              ? "conn-hadith-en"
              : undefined,
        connectorName:
          inferredSourceType === "quran"
            ? "Quran.com"
            : inferredSourceType === "hadith"
              ? "Sunnah connector"
              : undefined,
      };
    });

  return [...existingSources, ...recovered];
};

const searchSourcesWithPolicy = (payload, state, registry) =>
  withTimeout(
    () => searchSources(payload, state, registry),
    state.settings?.general?.sourceTimeoutMs,
    "Source retrieval",
  );

const buildBackendPreflight = (state) => {
  const issues = [];
  const warnings = [];
  const aiProviders = Array.isArray(state.aiProviders) ? state.aiProviders : [];

  for (const provider of aiProviders) {
    if (!provider?.enabled) continue;

    if (provider.providerType === "vertex-ai") {
      const credentialPath =
        process.env[provider.apiKeyRef || ""] || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
      if (!credentialPath) {
        issues.push(`Vertex AI is enabled but ${provider.apiKeyRef || "GOOGLE_APPLICATION_CREDENTIALS"} is not set.`);
      } else if (!existsSync(credentialPath)) {
        issues.push(`Vertex AI credential file was not found at: ${credentialPath}`);
      }
      continue;
    }

    if (provider.apiKeyRef && !process.env[provider.apiKeyRef]) {
      warnings.push(`${provider.name} is enabled but ${provider.apiKeyRef} is not set.`);
    }
  }

  for (const connector of state.connectors ?? []) {
    if (!connector?.enabled || !connector.apiKeyRef) continue;
    if (!process.env[connector.apiKeyRef]) {
      warnings.push(`${connector.name} is enabled but ${connector.apiKeyRef} is not set.`);
    }
    if (connector.params?.clientIdHint && !process.env[connector.params.clientIdHint]) {
      warnings.push(`${connector.name} is enabled but ${connector.params.clientIdHint} is not set.`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
};

const resolveProviderHealth = async (provider) => {
  const selectedModelId = provider.defaultModelId || provider.modelOptions?.find((option) => option.enabled)?.modelId;

  if (!provider.enabled) {
    return { ok: false, message: "Provider disabled." };
  }

  if (!selectedModelId) {
    return { ok: false, message: "No enabled model is configured." };
  }

  try {
    const adapter = createAIProviderAdapter(provider);
    return await adapter.healthCheck({ modelId: selectedModelId });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Health check failed.",
    };
  }
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    notFound(res);
    return;
  }

  if (req.method === "OPTIONS") {
    json(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const state = await readRuntimeState();
  const registry = createConnectorRegistry(state);
  const sessionId = url.searchParams.get("sessionId") || defaultSessionId;
  const aiService = (() => {
    try {
      return createAIService(state, { sessionId });
    } catch {
      return null;
    }
  })();

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      json(res, 200, { ok: true, service: "dawah-desk-backend" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/preflight") {
      json(res, 200, buildBackendPreflight(state));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/secrets") {
      json(res, 200, await listSecrets(state));
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/admin/secrets") {
      const body = await readBody(req);
      await writeSecrets(body.secrets ?? {});
      json(res, 200, await listSecrets(state));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/credentials/status") {
      json(res, 200, await getCredentialsStatus());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/credentials") {
      const body = await readBody(req);
      if (!body.json) {
        // Empty body = skip setup: write an empty credentials file so setup does not reappear.
        await writeSecrets({});
        json(res, 200, { ok: true });
        return;
      }
      try {
        await saveVertexCredentialJson(body.json);
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 400, { error: err instanceof Error ? err.message : "Invalid credential content." });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state/bootstrap") {
      const normalizedSnapshot = normalizeCasesAndBites(state.savedCases ?? [], state.savedBites ?? []);
      json(res, 200, {
        savedCases: normalizedSnapshot.savedCases,
        savedBites: normalizedSnapshot.savedBites,
        sourceRecords: buildRecoveredSourceRecords(state),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cases/classify") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.classifyCase(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cases/similar") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.findSimilarCases(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/resolve") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      const classification = await aiService.classifyCase(body);
      const similarCases = await aiService.findSimilarCases(body);
      const sources = await searchSourcesWithPolicy(
        { query: body.question, topic: classification.topic, limit: state.settings.general.defaultSourceResultLimit },
        state,
        registry,
      );
      json(res, 200, { classification, similarCases, ...sources });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sources/search") {
      const body = await readBody(req);
      json(res, 200, await searchSourcesWithPolicy(body, state, registry));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/quran/tafsirs") {
      json(res, 200, await listQfTafsirs());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/quran/translations") {
      json(res, 200, await listQfTranslations());
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/sources/")) {
      const sourceId = url.pathname.split("/").pop();
      const source = buildRecoveredSourceRecords(state).find((record) => record.sourceId === sourceId);
      if (!source) {
        notFound(res);
        return;
      }
      json(res, 200, source);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sources/save") {
      const body = await readBody(req);
      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          sourceRecords: [
            ...(currentState.sourceRecords ?? []).filter((record) => record.sourceId !== body.source.sourceId),
            body.source,
          ],
        }),
        {
          operation: {
            type: "source-save",
            source: body.source,
          },
        },
      );
      json(res, 200, body.source);
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/sources/")) {
      const sourceId = url.pathname.split("/").pop();
      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          sourceRecords: (currentState.sourceRecords ?? []).filter((record) => record.sourceId !== sourceId),
        }),
        {
          operation: {
            type: "source-delete",
            sourceId,
          },
        },
      );
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sources/translate") {
      const body = await readBody(req);
      const source = body.source ?? null;
      let result = null;
      const targetLanguage = resolveTargetLanguage(body.targetLanguageLabel || body.targetLanguageCode);
      const targetLanguageCode = targetLanguage.code;
      const targetLanguageLabel = targetLanguage.label;
      const translationCacheKey = JSON.stringify({
        sessionId,
        sourceId: source?.sourceId ?? body.sourceId ?? "",
        sourceLanguage: source?.sourceLanguage ?? "",
        excerpt: source?.excerpt ?? "",
        sourceType: source?.sourceType ?? "",
        targetLanguageCode,
        targetLanguageLabel,
        providerId: aiService?.provider?.providerId ?? "",
        modelId: aiService?.model?.modelId ?? "",
      });
      const cachedTranslation = readCachedValue("translation", translationCacheKey, {
        enabled: state.settings?.general?.cachingEnabled,
      });
      if (cachedTranslation) {
        json(res, 200, cachedTranslation);
        return;
      }

      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      try {
        result = await withTimeout(
          () =>
            aiService.translateSource({
              ...body,
              targetLanguageCode,
              targetLanguageLabel,
            }),
          state.settings?.general?.translationTimeoutMs,
          "AI translation",
        );
      } catch (error) {
        const aiMessage = error instanceof Error ? error.message : "Unknown AI translation error.";
        throw new Error(`AI translation failed: ${aiMessage}`);
      }
      if (!result) {
        notFound(res);
        return;
      }
      json(
        res,
        200,
        writeCachedValue("translation", translationCacheKey, result, {
          enabled: state.settings?.general?.cachingEnabled,
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/suggest-structure") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.suggestStructure(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/quick-assist") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.quickAssist(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/assess-confidence") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.assessConfidence(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/suggest-metadata") {
      const body = await readBody(req);
      if (!aiService) {
        throw new Error("No active AI provider/model is configured.");
      }
      json(res, 200, await aiService.suggestMetadata(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cases/save") {
      const body = await readBody(req);
      const normalizedCasePayload = normalizeCasesAndBites([body.caseItem], body.bites ?? []);
      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          savedCases: [
            ...currentState.savedCases.filter((item) => item.caseId !== body.caseItem.caseId),
            ...normalizedCasePayload.savedCases,
          ],
          savedBites: [
            ...currentState.savedBites.filter((bite) => bite.caseId !== body.caseItem.caseId),
            ...normalizedCasePayload.savedBites,
          ],
        }),
        {
          operation: {
            type: "case-save",
            caseItem: normalizedCasePayload.savedCases[0],
            bites: normalizedCasePayload.savedBites,
          },
        },
      );
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cases/import") {
      const body = await readBody(req);
      const caseContent = body.case;
      const biteContents = Array.isArray(body.bites) ? body.bites : [];

      if (!caseContent?.title || !caseContent?.originalQuestion) {
        json(res, 400, { message: "Invalid export file: missing required case fields." });
        return;
      }

      const newCaseId = `case-${Date.now()}`;
      const now = new Date().toISOString();

      const newCase = {
        caseId: newCaseId,
        title: String(caseContent.title ?? ""),
        originalQuestion: String(caseContent.originalQuestion ?? ""),
        contextNote: caseContent.contextNote ?? "",
        personName: caseContent.personName ?? "",
        platform: caseContent.platform ?? "",
        topic: caseContent.topic ?? "",
        audienceType: caseContent.audienceType ?? "",
        questionType: caseContent.questionType ?? "",
        difficulty: caseContent.difficulty ?? "",
        likelyIntent: caseContent.likelyIntent ?? "",
        status: "saved",
        relatedCaseIds: [],
        sourceIdsUsed: [],
        responseBiteIds: [],
        accessCount: 0,
        createdDate: now,
        updatedDate: now,
        confidenceStatus: "low",
      };

      const newBites = biteContents.map((bite, index) => ({
        // No biteId supplied — normalizeCaseBites generates fresh IDs
        caseId: newCaseId,
        biteOrder: bite.biteOrder ?? index + 1,
        biteTitle: bite.biteTitle ?? "",
        biteText: bite.biteText ?? "",
        bitePurpose: bite.bitePurpose ?? "key-claim",
        sourceCategory: bite.sourceCategory,
        supportStatus: bite.supportStatus ?? "ai-assisted",
        aiAssisted: Boolean(bite.aiAssisted),
        translationUsed: Boolean(bite.translationUsed),
        structuredSourceLayout: bite.structuredSourceLayout,
        sourcePrimaryText: bite.sourcePrimaryText,
        sourceSecondaryText: bite.sourceSecondaryText,
        translationResourceName: bite.translationResourceName,
        sourceTafsirText: bite.sourceTafsirText,
        tafsirResourceName: bite.tafsirResourceName,
        notes: bite.notes,
        sourceLinks: [],
        supportStatusManuallySet: false,
      }));

      const normalizedPayload = normalizeCasesAndBites([newCase], newBites);

      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          savedCases: [...(currentState.savedCases ?? []), ...normalizedPayload.savedCases],
          savedBites: [...(currentState.savedBites ?? []), ...normalizedPayload.savedBites],
        }),
        {
          operation: {
            type: "case-save",
            caseItem: normalizedPayload.savedCases[0],
            bites: normalizedPayload.savedBites,
          },
        },
      );

      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/cases/")) {
      const caseId = url.pathname.split("/").pop();
      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          savedCases: (currentState.savedCases ?? []).filter((item) => item.caseId !== caseId),
          savedBites: (currentState.savedBites ?? []).filter((bite) => bite.caseId !== caseId),
          sourceRecords: (currentState.sourceRecords ?? []).map((source) => ({
            ...source,
            linkedBiteIds: (source.linkedBiteIds ?? []).filter(
              (biteId) =>
                !(currentState.savedBites ?? []).some((bite) => bite.caseId === caseId && bite.biteId === biteId),
            ),
          })),
        }),
        {
          operation: {
            type: "case-delete",
            caseId,
          },
        },
      );
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/connectors") {
      const health = await Promise.all(
        state.connectors.map(async (connector) => {
          const adapter = registry[connector.category];
          const health = adapter?.healthCheck ? await adapter.healthCheck() : connector.enabled ? { ok: true, message: "Configured" } : { ok: false, message: "Disabled" };
          return {
            ...connector,
            health,
          };
        }),
      );
      json(res, 200, health);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/connectors") {
      const body = await readBody(req);
      const nextConnector = {
        ...body,
        connectorId: body.connectorId || `conn-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await updateRuntimeState((currentState) => ({
        ...currentState,
        connectors: [...currentState.connectors, nextConnector],
      }));
      json(res, 201, nextConnector);
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/connectors/")) {
      const connectorId = url.pathname.split("/").pop();
      const body = await readBody(req);
      const nextState = await updateRuntimeState((currentState) => ({
        ...currentState,
        connectors: currentState.connectors.map((connector) =>
          connector.connectorId === connectorId
            ? { ...connector, ...body, updatedAt: new Date().toISOString() }
            : connector,
        ),
      }));
      json(res, 200, nextState.connectors.find((connector) => connector.connectorId === connectorId));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/settings") {
      json(res, 200, state.settings);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai/providers") {
      const providers = await Promise.all(
        (state.aiProviders ?? []).map(async (provider) => {
          return {
            ...provider,
            health: await resolveProviderHealth(provider),
          };
        }),
      );
      json(res, 200, providers);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/ai/providers") {
      const body = await readBody(req);
      const now = new Date().toISOString();
      const nextProvider = {
        ...body,
        providerId: body.providerId || `ai-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      await updateRuntimeState((currentState) => ({
        ...currentState,
        aiProviders: [...(currentState.aiProviders ?? []), nextProvider],
      }));
      json(res, 201, nextProvider);
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/ai/providers/")) {
      const providerId = url.pathname.split("/").pop();
      const body = await readBody(req);
      const nextState = await updateRuntimeState((currentState) => ({
        ...currentState,
        aiProviders: (currentState.aiProviders ?? []).map((provider) =>
          provider.providerId === providerId
            ? {
                ...provider,
                ...body,
                updatedAt: new Date().toISOString(),
              }
            : provider,
        ),
      }));
      json(res, 200, nextState.aiProviders.find((provider) => provider.providerId === providerId));
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/admin\/ai\/providers\/[^/]+\/test$/)) {
      const parts = url.pathname.split("/");
      const providerId = parts[parts.length - 2];
      const provider = (state.aiProviders ?? []).find((item) => item.providerId === providerId);
      if (!provider) {
        notFound(res);
        return;
      }

      json(res, 200, await resolveProviderHealth(provider));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/session/ai-selection") {
      const { provider, model, sessionSelection } = createAIService(state, { sessionId });
      json(res, 200, {
        ...sessionSelection,
        providerName: provider.name,
        modelLabel: model.label,
      });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/session/ai-selection") {
      const body = await readBody(req);
      const defaults = state.settings?.aiDefaults ?? {};
      const nextSelection = {
        sessionId,
        providerId: body.providerId || defaults.defaultProviderId,
        modelId: body.modelId || defaults.defaultModelId,
        inheritedFromDefault: Boolean(body.inheritedFromDefault),
        updatedAt: new Date().toISOString(),
      };

      await updateRuntimeState((currentState) => ({
        ...currentState,
        sessionAiSelections: {
          ...(currentState.sessionAiSelections ?? {}),
          [sessionId]: nextSelection,
        },
      }));
      json(res, 200, nextSelection);
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/admin/settings") {
      const body = await readBody(req);
      const nextState = await updateRuntimeState((currentState) => ({
        ...currentState,
        settings: {
          general: { ...currentState.settings.general, ...(body.general ?? {}) },
          aiDefaults: { ...currentState.settings.aiDefaults, ...(body.aiDefaults ?? {}) },
        },
      }));
      json(res, 200, nextState.settings);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/library/restore") {
      const body = await readBody(req);

      if (
        typeof body.backupVersion !== "number" ||
        !Array.isArray(body.savedCases) ||
        !Array.isArray(body.savedBites) ||
        !Array.isArray(body.sourceRecords)
      ) {
        json(res, 400, { error: "Invalid backup file: missing required fields." });
        return;
      }

      // Write safety snapshot of current library before replacing it.
      await writePreRestoreBackup(state);

      await updateRuntimeState(
        (currentState) => ({
          ...currentState,
          savedCases: body.savedCases,
          savedBites: body.savedBites,
          sourceRecords: body.sourceRecords,
        }),
        {
          operation: {
            type: "restore",
            caseCount: body.savedCases.length,
            sourceCount: body.sourceRecords.length,
            recordedAt: new Date().toISOString(),
          },
        },
      );

      await clearOpsLog();

      json(res, 200, {
        ok: true,
        caseCount: body.savedCases.length,
        sourceCount: body.sourceRecords.length,
      });
      return;
    }

    notFound(res);
  } catch (error) {
    json(res, 500, {
      error: "Server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

async function main() {
  await loadCredentials();
  const { configured } = await getCredentialsStatus();
  console.log(
    configured
      ? "[Da'wah Desk] Credentials loaded from DawahDeskData."
      : "[Da'wah Desk] No credentials found — first-run setup required.",
  );
  server.listen(port, () => {
    console.log(`Da'wah Desk backend running on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error("[Da'wah Desk] Startup failed:", error.message);
  process.exit(1);
});
