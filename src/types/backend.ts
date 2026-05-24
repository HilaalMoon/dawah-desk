import { CaseDraftInput, CaseRecord, ResponseBite, SourceItem } from "@/types";

export type TrustTier = 1 | 2 | 3 | 4;

export type ConnectorConfig = {
  connectorId: string;
  name: string;
  category: "quran" | "hadith-en" | "hadith-ar" | "other" | "ai" | "web";
  enabled: boolean;
  connectionType: "api" | "web" | "manual";
  baseUrl?: string;
  apiKeyRef?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  trustTier: TrustTier;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  health?: {
    ok: boolean;
    message?: string;
  };
};

export type AIProviderType = "openai" | "anthropic" | "custom-openai-compatible" | "vertex-ai" | "other";

export type AIModelOption = {
  modelId: string;
  label: string;
  enabled: boolean;
  supportsStructuredOutput?: boolean;
  supportsToolUse?: boolean;
  supportsReasoning?: boolean;
  notes?: string;
};

export type AIProviderConfig = {
  providerId: string;
  name: string;
  providerType: AIProviderType;
  enabled: boolean;
  baseUrl?: string;
  apiKeyRef?: string;
  projectId?: string;
  location?: string;
  modelOptions: AIModelOption[];
  defaultModelId?: string;
  headers?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  health?: {
    ok: boolean;
    message?: string;
  };
};

export type SessionAISelection = {
  sessionId: string;
  providerId: string;
  modelId: string;
  inheritedFromDefault: boolean;
  updatedAt: string;
};

export type AIDefaultSelection = {
  defaultProviderId: string;
  defaultModelId: string;
};

export type AIJobType =
  | "classify-case"
  | "find-similar-cases"
  | "plan-source-query"
  | "translate"
  | "suggest-bites"
  | "formulate-response"
  | "assess-confidence"
  | "suggest-save-metadata";

export type AIProviderHealthResult = {
  ok: boolean;
  message?: string;
};

export type GeneralBackendSettings = {
  defaultSourceResultLimit: number;
  cachingEnabled: boolean;
  allowWebFallback: boolean;
  fallbackDomainAllowlist: string[];
  similarityThreshold: number;
  sourceTimeoutMs: number;
  translationTimeoutMs: number;
  topicsList: string[];
  audienceTypeList: string[];
  questionTypeList: string[];
  difficultyList: string[];
  likelyIntentList: string[];
};

export type AdminSettingsPayload = {
  general: GeneralBackendSettings;
  aiDefaults: AIDefaultSelection;
};

export type WorkspaceResolvePayload = CaseDraftInput & {
  topic?: string;
};

export type SourceSearchPayload = {
  query: string;
  topic?: string;
  category?: "quran" | "hadith";
  limit?: number;
  includeTranslation?: boolean;
  externalOnly?: boolean;
  translationResourceId?: number;
  tafsirResourceId?: number;
};

export type QuranTafsirResource = {
  id: number;
  name: string;
  languageName?: string;
  authorName?: string;
  slug?: string;
};

export type QuranTranslationResource = {
  id: number;
  name: string;
  languageName?: string;
  authorName?: string;
  slug?: string;
};

export type SaveCasePayload = {
  caseItem: CaseRecord;
  bites: ResponseBite[];
};

export type BootstrapStatePayload = {
  savedCases: CaseRecord[];
  savedBites: ResponseBite[];
  sourceRecords: SourceItem[];
};

export type BackendPreflightStatus = {
  ok: boolean;
  issues: string[];
  warnings: string[];
};

export type BackendSecretRecord = {
  name: string;
  value: string;
  configured: boolean;
};

export type BackendSecretsPayload = {
  filePath: string;
  loadedFilePath: string;
  secrets: BackendSecretRecord[];
};

export type CredentialsStatus = {
  configured: boolean;
};

export type LibraryBackupFile = {
  backupVersion: number;
  exportedAt: string;
  exportedBy: string;
  savedCases: CaseRecord[];
  savedBites: ResponseBite[];
  sourceRecords: SourceItem[];
};

export type CaseExportFile = {
  exportedAt: string;
  exportedBy: string;
  version: number;
  case: {
    title: string;
    originalQuestion: string;
    contextNote?: string;
    topic: string;
    audienceType: string;
    questionType: string;
    difficulty: string;
    likelyIntent: string;
    platform?: string;
    personName?: string;
  };
  bites: Array<{
    biteOrder: number;
    biteTitle: string;
    biteText: string;
    bitePurpose: string;
    sourceCategory?: string;
    supportStatus: string;
    aiAssisted: boolean;
    translationUsed: boolean;
    structuredSourceLayout?: string;
    sourcePrimaryText?: string;
    sourceSecondaryText?: string;
    translationResourceName?: string;
    sourceTafsirText?: string;
    tafsirResourceName?: string;
    notes?: string;
  }>;
};
