export type CaseStatus = "new" | "researching" | "drafting" | "ready" | "saved";
export type ConfidenceStatus = "high" | "medium" | "low" | "mixed";
export type SourceLanguage = "Arabic" | "English";
export type SourceType = "quran" | "hadith" | "scholarly-note" | "user-note" | "article" | "saved-bite";
export type TrustLevel = "high" | "medium" | "needs-review";
export type SupportStatus =
  | "direct-source"
  | "translated-source"
  | "ai-assisted"
  | "weak-support"
  | "missing-support";
export type BitePurpose =
  | "opening"
  | "key-claim"
  | "evidence"
  | "clarification"
  | "objection-response"
  | "invitation"
  | "summary";

export type CaseRecord = {
  caseId: string;
  title: string;
  originalQuestion: string;
  contextNote?: string;
  personName?: string;
  platform?: string;
  topic: string;
  audienceType: string;
  questionType: string;
  difficulty: string;
  likelyIntent: string;
  createdDate: string;
  updatedDate: string;
  status: CaseStatus;
  relatedCaseIds: string[];
  sourceIdsUsed: string[];
  responseBiteIds: string[];
  confidenceStatus: ConfidenceStatus;
  accessCount?: number;
};

export type ResponseBite = {
  biteId: string;
  caseId: string;
  biteOrder: number;
  biteTitle: string;
  biteText: string;
  sourceCategory?: "quran" | "hadith" | "user" | "other";
  structuredSourceLayout?: "split-source";
  sourcePrimaryText?: string;
  sourceSecondaryText?: string;
  sourceSecondaryLabel?: string;
  translationResourceName?: string;
  sourceTafsirText?: string;
  sourceTafsirLabel?: string;
  tafsirResourceName?: string;
  bitePurpose: BitePurpose;
  sourceLinks: string[];
  supportStatus: SupportStatus;
  supportStatusManuallySet?: boolean;
  aiAssisted: boolean;
  translationUsed: boolean;
  usedInConversation?: boolean;
  notes?: string;
};

export type SourceItem = {
  sourceId: string;
  sourceType: SourceType;
  sourceTitle: string;
  topic?: string;
  sourceLanguage: SourceLanguage;
  excerpt: string;
  fullReference: string;
  trustLevel: TrustLevel;
  translationAvailable: boolean;
  authenticatedTranslation?: string;
  translationResourceId?: number;
  translationResourceName?: string;
  tafsirText?: string;
  tafsirResourceId?: number;
  tafsirResourceName?: string;
  tafsirLanguageName?: string;
  linkedBiteIds: string[];
  sourceOrigin?: "seed" | "connector" | "manual";
  connectorId?: string;
  connectorName?: string;
  accessCount?: number;
};

export type SaveMetadataSuggestion = {
  suggestedTitle: string;
  tags: string[];
  audienceType: string;
  questionType: string;
  relatedThemes: string[];
  duplicateWarning?: string;
  summarySnippet: string;
};

export type ActiveCaseTab = {
  tabId: string;
  caseId: string;
  tabTitle: string;
  unsavedChangesFlag: boolean;
  lastActiveTimestamp: string;
  isPinned?: boolean;
};

export type CaseClassification = Pick<
  CaseRecord,
  "topic" | "audienceType" | "questionType" | "difficulty" | "likelyIntent"
>;

export type CaseDraftInput = {
  caseName?: string;
  question: string;
  topic?: string;
  contextNote?: string;
  personName?: string;
  platform?: string;
};

export type SimilarCaseMatch = {
  caseItem: CaseRecord;
  matchScore: number;
  reasons: string[];
  matchingBites: ResponseBite[];
};

export type SourceRecommendation = {
  source: SourceItem;
  reason: string;
};

export type StructureSuggestion = {
  biteTitle: string;
  bitePurpose: BitePurpose;
  guidance: string;
};

export type TranslationResult = {
  sourceId: string;
  sourceTitle?: string;
  sourceLinks?: string[];
  aiAssisted?: boolean;
  originalText: string;
  workingTranslation: string;
  alternatives: string[];
  warning?: string;
  targetLanguageCode?: string;
  targetLanguageLabel?: string;
};

export type QuickAssistMessage = {
  messageId: string;
  role: "user" | "assistant";
  text: string;
};
