import { mockAiService } from "@/services/mockAi";
import { sourceItems } from "@/data/seed";
import {
  audienceTypeOptions,
  difficultyOptions,
  likelyIntentOptions,
  questionTypeOptions,
} from "@/data/classificationOptions";
import {
  CaseClassification,
  CaseDraftInput,
  CaseRecord,
  ResponseBite,
  SaveMetadataSuggestion,
  SimilarCaseMatch,
  SourceItem,
  SourceRecommendation,
  StructureSuggestion,
  SupportStatus,
  TranslationResult,
} from "@/types";
import {
  AIDefaultSelection,
  AdminSettingsPayload,
  AIProviderConfig,
  AIProviderHealthResult,
  BackendSecretsPayload,
  BackendPreflightStatus,
  BootstrapStatePayload,
  CaseExportFile,
  LibraryBackupFile,
  ConnectorConfig,
  CredentialsStatus,
  QuranTafsirResource,
  QuranTranslationResource,
  SaveCasePayload,
  SessionAISelection,
  SourceSearchPayload,
  WorkspaceResolvePayload,
} from "@/types/backend";

const fallbackConnectors: ConnectorConfig[] = [
  {
    connectorId: "conn-quran-primary",
    name: "Quran Foundation Adapter",
    category: "quran",
    enabled: true,
    connectionType: "api",
    baseUrl: "https://apis-prelive.quran.foundation",
    apiKeyRef: "QF_CLIENT_SECRET",
    headers: {},
    params: {
      environment: "prelive",
      authBaseUrl: "https://prelive-oauth2.quran.foundation",
      clientIdHint: "QF_CLIENT_ID",
      language: "Arabic",
    },
    trustTier: 1,
    notes: "Uses Quran Foundation retrieval as the primary Quran source connector.",
    health: { ok: true, message: "Local fallback configuration loaded" },
  },
  {
    connectorId: "conn-hadith-en",
    name: "Sunnah English Adapter",
    category: "hadith-en",
    enabled: true,
    connectionType: "api",
    baseUrl: "TODO_HADITH_EN_PROVIDER_URL",
    apiKeyRef: "TODO_HADITH_EN_PROVIDER_KEY",
    headers: {},
    params: { language: "English" },
    trustTier: 1,
    notes: "Reserved slot for a future dedicated Sunnah English API connector.",
    health: { ok: false, message: "Placeholder connector" },
  },
  {
    connectorId: "conn-hadith-ar",
    name: "Sunnah Arabic Adapter",
    category: "hadith-ar",
    enabled: true,
    connectionType: "api",
    baseUrl: "TODO_HADITH_AR_PROVIDER_URL",
    apiKeyRef: "TODO_HADITH_AR_PROVIDER_KEY",
    headers: {},
    params: { language: "Arabic" },
    trustTier: 1,
    notes: "Reserved slot for a future dedicated Sunnah Arabic API connector.",
    health: { ok: false, message: "Placeholder connector" },
  },
  {
    connectorId: "conn-approved-other",
    name: "Approved Sources Adapter",
    category: "other",
    enabled: true,
    connectionType: "manual",
    baseUrl: "",
    apiKeyRef: "",
    headers: {},
    params: {},
    trustTier: 2,
    notes: "Manual adapter for approved non-Quran and non-Sunnah sources.",
    health: { ok: true, message: "Local fallback configuration loaded" },
  },
  {
    connectorId: "conn-web-fallback",
    name: "Controlled Web Fallback",
    category: "web",
    enabled: false,
    connectionType: "web",
    baseUrl: "",
    apiKeyRef: "",
    headers: {},
    params: {},
    trustTier: 4,
    notes: "Controlled approved-domain fallback for Quran.com and Sunnah.com.",
    health: { ok: false, message: "Disabled by default" },
  },
];

const fallbackSettings: AdminSettingsPayload = {
  general: {
    defaultSourceResultLimit: 8,
    cachingEnabled: true,
    allowWebFallback: false,
    fallbackDomainAllowlist: ["quran.com", "sunnah.com"],
    similarityThreshold: 0.45,
    sourceTimeoutMs: 7000,
    translationTimeoutMs: 6000,
    topicsList: [
      "zzGeneral",
      "Allah / Tawhid",
      "Prophethood",
      "Qur'an",
      "Sunnah",
      "Aqidah / Belief",
      "Worship and Practice",
      "Christianity / Jesus",
      "Science and Reason",
      "Women and Family",
      "Jihad and Misconceptions",
      "Afterlife and Salvation",
      "Personal Doubts / Guidance",
    ],
    audienceTypeList: [...audienceTypeOptions],
    questionTypeList: [...questionTypeOptions],
    difficultyList: [...difficultyOptions],
    likelyIntentList: [...likelyIntentOptions],
  },
  aiDefaults: {
    defaultProviderId: "ai-vertex-primary",
    defaultModelId: "gemini-2.5-flash",
  },
};

class BackendApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
  }
}

const fetchJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      message = body?.message || body?.error || message;
    } catch {
      // keep default message
    }
    throw new BackendApiError(message, response.status);
  }

  return response.json() as Promise<T>;
};

export const backendApi = {
  async classifyCase(draft: CaseDraftInput): Promise<CaseClassification> {
    try {
      return await fetchJson<CaseClassification>("/api/cases/classify", {
        method: "POST",
        body: JSON.stringify(draft),
      });
    } catch {
      return mockAiService.classifyCase(draft);
    }
  },

  async findSimilarCases(draft: CaseDraftInput): Promise<SimilarCaseMatch[]> {
    try {
      const matches = await fetchJson<SimilarCaseMatch[]>("/api/cases/similar", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      return matches.length > 0 ? matches : mockAiService.findSimilarCases(draft);
    } catch {
      return mockAiService.findSimilarCases(draft);
    }
  },

  async resolveWorkspace(payload: WorkspaceResolvePayload): Promise<{ recommendations: SourceRecommendation[] }> {
    try {
      const result = await fetchJson<{ flatRecommendations: SourceRecommendation[] }>("/api/workspace/resolve", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { recommendations: result.flatRecommendations };
    } catch {
      return { recommendations: await mockAiService.recommendSources(payload) };
    }
  },

  async translateSource(
    source: SourceItem,
    options?: {
      targetLanguageCode?: string;
      targetLanguageLabel?: string;
    },
  ): Promise<TranslationResult> {
    try {
      return await fetchJson<TranslationResult>("/api/sources/translate", {
        method: "POST",
        body: JSON.stringify({
          sourceId: source.sourceId,
          source,
          targetLanguageCode: options?.targetLanguageCode,
          targetLanguageLabel: options?.targetLanguageLabel,
        }),
      });
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw error;
      }
      throw new BackendApiError("Translation is unavailable because the backend could not be reached.");
    }
  },

  async quickAssist(prompt: string): Promise<{ text: string }> {
      return fetchJson<{ text: string }>("/api/ai/quick-assist", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
    },

  async suggestStructure(draft: CaseDraftInput): Promise<StructureSuggestion[]> {
    return fetchJson<StructureSuggestion[]>("/api/ai/suggest-structure", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  },

  async assessConfidence(
    bites: ResponseBite[],
    sourceCatalog: SourceItem[],
  ): Promise<Record<string, SupportStatus>> {
    try {
      return await fetchJson<Record<string, SupportStatus>>("/api/ai/assess-confidence", {
        method: "POST",
        body: JSON.stringify({ bites, sourceCatalog }),
      });
    } catch {
      return mockAiService.assessConfidence(bites, sourceCatalog);
    }
  },

  async suggestMetadata(caseItem: CaseRecord, bites: ResponseBite[]): Promise<SaveMetadataSuggestion> {
    try {
      return await fetchJson<SaveMetadataSuggestion>("/api/ai/suggest-metadata", {
        method: "POST",
        body: JSON.stringify({ caseItem, bites }),
      });
    } catch {
      return mockAiService.suggestSaveMetadata(caseItem, bites);
    }
  },

  async saveCase(payload: SaveCasePayload): Promise<void> {
    try {
      await fetchJson("/api/cases/save", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      // Keep local-first save behavior even if backend is unavailable.
    }
  },

  async importCases(data: CaseExportFile): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>("/api/cases/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async restoreLibrary(data: LibraryBackupFile): Promise<{ ok: boolean; caseCount: number; sourceCount: number }> {
    return fetchJson<{ ok: boolean; caseCount: number; sourceCount: number }>("/api/library/restore", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteCase(caseId: string): Promise<void> {
    await fetchJson(`/api/cases/${caseId}`, {
      method: "DELETE",
    });
  },

  async getBootstrapState(): Promise<BootstrapStatePayload> {
    return fetchJson<BootstrapStatePayload>("/api/state/bootstrap");
  },

  async getBackendPreflight(): Promise<BackendPreflightStatus> {
    return fetchJson<BackendPreflightStatus>("/api/admin/preflight");
  },

  async getBackendSecrets(): Promise<BackendSecretsPayload> {
    return fetchJson<BackendSecretsPayload>("/api/admin/secrets");
  },

  async updateBackendSecrets(secrets: Record<string, string>): Promise<BackendSecretsPayload> {
    return fetchJson<BackendSecretsPayload>("/api/admin/secrets", {
      method: "PATCH",
      body: JSON.stringify({ secrets }),
    });
  },

  async saveSourceRecord(source: SourceItem): Promise<SourceItem> {
    return fetchJson<SourceItem>("/api/sources/save", {
      method: "POST",
      body: JSON.stringify({ source }),
    });
  },

  async deleteSourceRecord(sourceId: string): Promise<void> {
    await fetchJson("/api/sources/" + sourceId, {
      method: "DELETE",
    });
  },

  async searchSources(payload: SourceSearchPayload): Promise<{ recommendations: SourceRecommendation[] }> {
    try {
      const result = await fetchJson<{ flatRecommendations: SourceRecommendation[] }>("/api/sources/search", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { recommendations: result.flatRecommendations };
    } catch {
      if (payload.category === "quran" || payload.category === "hadith") {
        const tab = payload.category === "quran" ? "Quran" : "Sunnah";
        return {
          recommendations: mockAiService
            .searchSourcesSemantic(payload.query, sourceItems, tab, payload.topic)
            .map((source) => ({
              source,
              reason: "Fallback local semantic search.",
            })),
        };
      }
      return { recommendations: [] };
    }
  },

  async retrieveSourcesExternal(payload: SourceSearchPayload): Promise<{ recommendations: SourceRecommendation[] }> {
    const result = await fetchJson<{ flatRecommendations: SourceRecommendation[] }>("/api/sources/search", {
      method: "POST",
      body: JSON.stringify({ ...payload, externalOnly: true }),
    });
    return { recommendations: result.flatRecommendations };
  },

  async getQuranTafsirResources(): Promise<QuranTafsirResource[]> {
    return fetchJson<QuranTafsirResource[]>("/api/quran/tafsirs");
  },

  async getQuranTranslationResources(): Promise<QuranTranslationResource[]> {
    return fetchJson<QuranTranslationResource[]>("/api/quran/translations");
  },

  async getConnectors(): Promise<ConnectorConfig[]> {
    return fetchJson<ConnectorConfig[]>("/api/admin/connectors");
  },

  async addConnector(connector: Omit<ConnectorConfig, "connectorId" | "createdAt" | "updatedAt" | "health">): Promise<ConnectorConfig> {
    return fetchJson<ConnectorConfig>("/api/admin/connectors", {
      method: "POST",
      body: JSON.stringify(connector),
    });
  },

  async updateConnector(connectorId: string, changes: Partial<ConnectorConfig>): Promise<ConnectorConfig> {
    return fetchJson<ConnectorConfig>(`/api/admin/connectors/${connectorId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  },

  async getSettings(): Promise<AdminSettingsPayload> {
    try {
      return await fetchJson<AdminSettingsPayload>("/api/admin/settings");
    } catch {
      return fallbackSettings;
    }
  },

  async updateSettings(changes: Partial<AdminSettingsPayload>): Promise<AdminSettingsPayload> {
    return fetchJson<AdminSettingsPayload>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  },

  async getAIProviders(): Promise<AIProviderConfig[]> {
    return fetchJson<AIProviderConfig[]>("/api/admin/ai/providers");
  },

  async addAIProvider(
    provider: Omit<AIProviderConfig, "providerId" | "createdAt" | "updatedAt" | "health">,
  ): Promise<AIProviderConfig> {
    return fetchJson<AIProviderConfig>("/api/admin/ai/providers", {
      method: "POST",
      body: JSON.stringify(provider),
    });
  },

  async updateAIProvider(providerId: string, changes: Partial<AIProviderConfig>): Promise<AIProviderConfig> {
    return fetchJson<AIProviderConfig>(`/api/admin/ai/providers/${providerId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  },

  async testAIProvider(providerId: string): Promise<AIProviderHealthResult> {
    return fetchJson<AIProviderHealthResult>(`/api/admin/ai/providers/${providerId}/test`, {
      method: "POST",
    });
  },

  async getSessionAISelection(): Promise<SessionAISelection> {
    return fetchJson<SessionAISelection>("/api/session/ai-selection");
  },

  async updateSessionAISelection(
    changes: Partial<SessionAISelection> & Pick<SessionAISelection, "providerId" | "modelId">,
  ): Promise<SessionAISelection> {
    return fetchJson<SessionAISelection>("/api/session/ai-selection", {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  },

  async getCredentialsStatus(): Promise<CredentialsStatus> {
    return fetchJson<CredentialsStatus>("/api/admin/credentials/status");
  },

  async submitCredentials(jsonContent: string): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>("/api/admin/credentials", {
      method: "POST",
      body: JSON.stringify({ json: jsonContent }),
    });
  },
};
