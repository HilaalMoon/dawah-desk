import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  audienceTypeOptions,
  constrainTopicToAllowedOptions,
  constrainToOptions,
  difficultyOptions,
  likelyIntentOptions,
  questionTypeOptions,
  topicOptions,
} from "@/data/classificationOptions";
import { activeCaseTabs, responseBites, saveMetadataSuggestions, savedCases, sourceItems } from "@/data/seed";
import { backendApi } from "@/services/backendApi";
import { mockAiService } from "@/services/mockAi";
import {
  ActiveCaseTab,
  CaseClassification,
  CaseDraftInput,
  CaseRecord,
  ResponseBite,
  SaveMetadataSuggestion,
  SimilarCaseMatch,
  SourceItem,
  SourceRecommendation,
  StructureSuggestion,
  TranslationResult,
} from "@/types";

type ViewKey = "home" | "new-case" | "workspace" | "library" | "case-detail" | "save-review" | "sources" | "settings" | "quick-aissist";

type AppState = {
  currentView: ViewKey;
  navigationLabel: string;
  savedCases: CaseRecord[];
  activeTabs: ActiveCaseTab[];
  sourceItems: SourceItem[];
  savedBites: ResponseBite[];
  currentCaseId: string | null;
  workspaceBites: Record<string, ResponseBite[]>;
  selectedSourceIds: Record<string, string[]>;
  recommendedSourcesByCase: Record<string, SourceRecommendation[]>;
  similarMatches: SimilarCaseMatch[];
  structureSuggestionsByCase: Record<string, StructureSuggestion[]>;
  saveMetadataByCase: Record<string, SaveMetadataSuggestion>;
  translationModalOpen: boolean;
  translationSourceId: string | null;
  translationResult: TranslationResult | null;
  selectedLibraryCaseId: string | null;
  searchTerm: string;
  isClassifying: boolean;
  isLoadingSimilar: boolean;
  isLoadingSources: boolean;
  isGeneratingStructure: boolean;
  isTranslating: boolean;
  draftForm: CaseDraftInput;
  classificationDraft: CaseClassification;
  setCurrentView: (view: ViewKey, label?: string) => void;
  setSearchTerm: (term: string) => void;
  selectCase: (caseId: string) => void;
  updateDraftField: (field: keyof CaseDraftInput, value: string) => void;
  updateClassificationField: (field: keyof CaseClassification, value: string) => void;
  runClassification: () => Promise<void>;
  createCaseFromDraft: () => Promise<void>;
  closeTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  addSourceToWorkspace: (caseId: string, sourceId: string) => void;
  addSavedBiteToWorkspace: (caseId: string, bite: ResponseBite) => void;
  updateWorkspaceBite: (caseId: string, biteId: string, changes: Partial<ResponseBite>) => void;
  addEmptyBite: (caseId: string) => void;
  moveBite: (caseId: string, biteId: string, direction: "up" | "down") => void;
  removeBite: (caseId: string, biteId: string) => void;
  generateStructure: (caseId: string) => Promise<void>;
  acceptStructureSuggestion: (caseId: string, suggestionIndex: number) => void;
  clearStructureSuggestions: (caseId: string) => void;
  loadRecommendedSources: (caseId: string) => Promise<void>;
  refreshSimilarMatches: () => Promise<void>;
  assessConfidence: (caseId: string) => Promise<void>;
  openTranslationModal: (sourceId?: string) => Promise<void>;
  openTranslationForText: (
    text: string,
    label: string,
    sourceLinks?: string[],
    aiAssisted?: boolean,
    options?: {
      executeNow?: boolean;
      targetLanguageCode?: string;
      targetLanguageLabel?: string;
    },
  ) => Promise<void>;
  closeTranslationModal: () => void;
  insertTranslationIntoBites: (caseId: string, textOverride?: string) => void;
  openSaveReview: (caseId: string) => Promise<void>;
  confirmSaveCase: (caseId: string) => void;
  updateCaseDetails: (
    caseId: string,
    changes: Partial<
      Pick<
        CaseRecord,
        | "title"
        | "originalQuestion"
        | "contextNote"
        | "personName"
        | "platform"
        | "topic"
        | "audienceType"
        | "questionType"
        | "difficulty"
        | "likelyIntent"
      >
    >,
  ) => void;
  updateCaseTags: (caseId: string, tags: string[]) => void;
  saveSourceToLibrary: (source: SourceItem) => void;
  removeSourceFromLibrary: (sourceId: string) => void;
  openLibrary: () => void;
  openCaseDetail: (caseId: string) => void;
  deleteSavedCase: (caseId: string) => void;
  reuseFullCaseSequence: (sourceCaseId: string, targetCaseId: string) => void;
  duplicateCaseFromLibrary: (sourceCaseId: string) => void;
  hydrateFromBackendSnapshot: (payload: {
    savedCases: CaseRecord[];
    savedBites: ResponseBite[];
    sourceRecords: SourceItem[];
  }) => void;
};

const blankClassification: CaseClassification = {
  topic: "Awaiting classification",
  audienceType: "Awaiting classification",
  questionType: "Awaiting classification",
  difficulty: "Needs review",
  likelyIntent: "Needs review",
};

const blankDraft: CaseDraftInput = {
  caseName: "",
  question: "",
  contextNote: "",
  personName: "",
  platform: "",
};

const normalizeTopicValue = (value = "") => value.trim().toLowerCase();

const constrainTopicToList = (topic: string, allowedTopics: string[]) =>
  allowedTopics.length ? constrainTopicToAllowedOptions(topic, allowedTopics) : topic;

const normalizeClassificationToOptions = (
  classification: CaseClassification,
  allowedTopics: string[],
  audienceOptions: readonly string[],
  questionOptions: readonly string[],
  difficultyChoices: readonly string[],
  intentOptions: readonly string[],
) => ({
  topic: constrainTopicToList(classification.topic, allowedTopics),
  audienceType: constrainToOptions(classification.audienceType, audienceOptions, ""),
  questionType: constrainToOptions(classification.questionType, questionOptions, ""),
  difficulty: constrainToOptions(classification.difficulty, difficultyChoices, ""),
  likelyIntent: constrainToOptions(classification.likelyIntent, intentOptions, ""),
});

const getClassificationLists = (settings?: { general?: {
  topicsList?: string[];
  audienceTypeList?: string[];
  questionTypeList?: string[];
  difficultyList?: string[];
  likelyIntentList?: string[];
} } | null) => ({
  topics: settings?.general?.topicsList?.length ? settings.general.topicsList : [...topicOptions],
  audience: settings?.general?.audienceTypeList?.length ? settings.general.audienceTypeList : [...audienceTypeOptions],
  questions: settings?.general?.questionTypeList?.length ? settings.general.questionTypeList : [...questionTypeOptions],
  difficulties: settings?.general?.difficultyList?.length ? settings.general.difficultyList : [...difficultyOptions],
  intents: settings?.general?.likelyIntentList?.length ? settings.general.likelyIntentList : [...likelyIntentOptions],
});

const buildLocalSimilarMatches = (draft: CaseDraftInput, cases: CaseRecord[], bites: ResponseBite[]) => {
  const normalizedQuestion = draft.question.toLowerCase().trim();
  const queryWords = normalizedQuestion.split(/\W+/).filter((word) => word.length > 2);

  return cases
    .map((caseItem) => {
      let matchScore = 0;
      const reasons: string[] = [];
      const originalQuestion = caseItem.originalQuestion.toLowerCase();
      const caseTitle = caseItem.title.toLowerCase();

      if (originalQuestion === normalizedQuestion && normalizedQuestion) {
        matchScore += 70;
        reasons.push("exact question match");
      }

      if (originalQuestion.includes(normalizedQuestion) || normalizedQuestion.includes(originalQuestion)) {
        matchScore += 30;
        reasons.push("strong text overlap");
      }

      if (caseItem.topic && queryWords.some((word) => caseItem.topic.toLowerCase().includes(word))) {
        matchScore += 15;
        reasons.push("same topic");
      }

      const sharedWords = queryWords.filter((word) => originalQuestion.includes(word) || caseTitle.includes(word));
      if (sharedWords.length > 0) {
        matchScore += Math.min(sharedWords.length * 10, 30);
        reasons.push("similar wording");
      }

      return {
        caseItem,
        matchScore,
        reasons,
        matchingBites: bites.filter((bite) => bite.caseId === caseItem.caseId),
      };
    })
    .filter((match) => match.matchScore >= 25)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
};

const inferBitePurpose = (title: string, guidance: string, index: number, total: number): ResponseBite["bitePurpose"] => {
  const haystack = `${title} ${guidance}`.toLowerCase();
  if (haystack.includes("summary")) return "summary";
  if (haystack.includes("opening") || haystack.includes("acknowled")) return "opening";
  if (haystack.includes("objection")) return "objection-response";
  if (haystack.includes("invite")) return "invitation";
  if (haystack.includes("reference") || haystack.includes("evidence") || haystack.includes("qur") || haystack.includes("hadith")) return "evidence";
  if (haystack.includes("clarif")) return "clarification";
  if (index === 0) return "opening";
  if (index === total - 1) return "summary";
  return "key-claim";
};

const normalizeStructureSuggestions = (suggestions: StructureSuggestion[]) =>
  suggestions.map((suggestion, index) => ({
    ...suggestion,
    bitePurpose: inferBitePurpose(suggestion.biteTitle, suggestion.guidance, index, suggestions.length),
  }));

const randomBiteToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBiteId = (caseId: string, kind: string) => `bite-${caseId}-${kind}-${randomBiteToken()}`;

const normalizeCaseBites = (bites: ResponseBite[], fallbackKind = "restored") => {
  const seen = new Set<string>();

  return [...bites]
    .sort((a, b) => a.biteOrder - b.biteOrder)
    .map((bite, index) => {
      let nextId = bite.biteId?.trim() || createBiteId(bite.caseId, fallbackKind);
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

const normalizeWorkspaceBiteMap = (workspaceBites: Record<string, ResponseBite[]>) =>
  Object.fromEntries(
    Object.entries(workspaceBites).map(([caseId, bites]) => [caseId, normalizeCaseBites(bites ?? [], "restored")]),
  );

const normalizeCasesAndBites = (cases: CaseRecord[], bites: ResponseBite[]) => {
  const bitesByCase = new Map<string, ResponseBite[]>();

  for (const bite of bites) {
    if (!bitesByCase.has(bite.caseId)) {
      bitesByCase.set(bite.caseId, []);
    }
    bitesByCase.get(bite.caseId)?.push(bite);
  }

  const normalizedBites = Array.from(bitesByCase.values()).flatMap((caseBites) => normalizeCaseBites(caseBites));
  const normalizedCaseIds = new Map<string, string[]>();
  for (const bite of normalizedBites) {
    if (!normalizedCaseIds.has(bite.caseId)) {
      normalizedCaseIds.set(bite.caseId, []);
    }
    normalizedCaseIds.get(bite.caseId)?.push(bite.biteId);
  }

  return {
    cases: cases.map((caseItem) => ({
      ...caseItem,
      responseBiteIds: normalizedCaseIds.get(caseItem.caseId) ?? [],
    })),
    bites: normalizedBites,
  };
};

const syncCasesToWorkspaceBites = (cases: CaseRecord[], workspaceBites: Record<string, ResponseBite[]>) =>
  cases.map((caseItem) => ({
    ...caseItem,
    responseBiteIds: (workspaceBites[caseItem.caseId] ?? []).map((bite) => bite.biteId),
  }));

const cloneBiteForCase = (bite: ResponseBite, caseId: string, order: number): ResponseBite => ({
  ...bite,
  biteId: createBiteId(caseId, "reuse"),
  caseId,
  biteOrder: order,
  usedInConversation: false,
});

const mapWorkspaceBites = (cases: CaseRecord[]) =>
  Object.fromEntries(
    cases.map((caseItem) => [
      caseItem.caseId,
      responseBites
        .filter((bite) => bite.caseId === caseItem.caseId)
        .sort((a, b) => a.biteOrder - b.biteOrder),
    ]),
  );

const mapWorkspaceBitesFromSavedBites = (cases: CaseRecord[], bites: ResponseBite[]) =>
  Object.fromEntries(
    cases.map((caseItem) => [
      caseItem.caseId,
      bites.filter((bite) => bite.caseId === caseItem.caseId).sort((a, b) => a.biteOrder - b.biteOrder),
    ]),
  );

const sortTabs = (tabs: ActiveCaseTab[]) =>
  [...tabs].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.lastActiveTimestamp).getTime() - new Date(a.lastActiveTimestamp).getTime();
  });

const markCaseTabUnsaved = (tabs: ActiveCaseTab[], caseId: string) =>
  sortTabs(
    tabs.map((tab) =>
      tab.caseId === caseId
        ? {
            ...tab,
            unsavedChangesFlag: true,
            lastActiveTimestamp: new Date().toISOString(),
          }
        : tab,
    ),
  );

const clearCaseTabUnsaved = (tabs: ActiveCaseTab[], caseId: string) =>
  sortTabs(
    tabs.map((tab) =>
      tab.caseId === caseId
        ? {
            ...tab,
            unsavedChangesFlag: false,
            lastActiveTimestamp: new Date().toISOString(),
          }
        : tab,
    ),
  );

const appendReferenceToTranslation = (translation = "", reference = "") => {
  const cleanedTranslation = translation.trim();
  const cleanedReference = reference.replace(/^Qur'an\s*/i, "").trim();
  if (!cleanedTranslation) return "";
  if (!cleanedReference) return cleanedTranslation;
  return cleanedTranslation.includes(`(${cleanedReference})`)
    ? cleanedTranslation
    : `${cleanedTranslation} (${cleanedReference})`;
};

const supportsStoredSplitLayout = (source: SourceItem) =>
  (source.sourceType === "quran" || source.sourceType === "hadith") &&
  Boolean(source.authenticatedTranslation);

const getTranslationResourceLabel = (source: SourceItem) =>
  source.translationResourceName ??
  (source.sourceType === "quran" && source.authenticatedTranslation ? "Saheeh International" : undefined);

const getTafsirResourceLabel = (source: SourceItem) => source.tafsirResourceName ?? (source.tafsirText ? "Tafsir" : undefined);

const splitParagraphs = (value = "") =>
  value
    .split(/\r?\n\s*\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

const getSourceCategory = (source: SourceItem): ResponseBite["sourceCategory"] =>
  source.sourceType === "quran"
    ? "quran"
    : source.sourceType === "hadith"
      ? "hadith"
      : source.sourceType === "user-note"
        ? "user"
        : "other";

const buildBitesFromSource = (source: SourceItem, caseId: string, startOrder: number): ResponseBite[] => {
  const primaryParagraphs =
    source.sourceOrigin === "manual"
      ? splitParagraphs(source.excerpt)
      : [];
  const translationParagraphs =
    source.sourceOrigin === "manual" && source.authenticatedTranslation
      ? splitParagraphs(source.authenticatedTranslation)
      : [];
  const shouldSplit = primaryParagraphs.length > 1;
  const parts = shouldSplit ? primaryParagraphs : [source.excerpt];
  const splitTranslations =
    shouldSplit && translationParagraphs.length === primaryParagraphs.length ? translationParagraphs : [];

  return parts.map((part, index) => {
    const order = startOrder + index;
    const sequenceLabel = shouldSplit ? ` (${index + 1}/${parts.length})` : "";
    const translationText =
      supportsStoredSplitLayout(source) && source.authenticatedTranslation
        ? appendReferenceToTranslation(
            splitTranslations[index] ?? (!shouldSplit || index === 0 ? source.authenticatedTranslation : ""),
            source.fullReference,
          ) || undefined
        : undefined;

    return {
      biteId: createBiteId(caseId, "source"),
      caseId,
      biteOrder: order,
      biteTitle: `${source.sourceTitle}${sequenceLabel}`,
      biteText: part,
      structuredSourceLayout: supportsStoredSplitLayout(source) ? "split-source" : undefined,
      sourcePrimaryText: supportsStoredSplitLayout(source) ? part : undefined,
      sourceSecondaryText: translationText,
      sourceSecondaryLabel: supportsStoredSplitLayout(source) ? getTranslationResourceLabel(source) : undefined,
      translationResourceName: source.translationResourceName,
      sourceTafsirText: source.sourceType === "quran" ? source.tafsirText : undefined,
      sourceTafsirLabel: source.sourceType === "quran" ? getTafsirResourceLabel(source) : undefined,
      tafsirResourceName: source.tafsirResourceName,
      bitePurpose: "evidence",
      sourceCategory: getSourceCategory(source),
      sourceLinks: [source.sourceId],
      supportStatus:
        source.sourceType === "quran" || source.sourceType === "hadith"
          ? "direct-source"
          : source.translationAvailable
            ? "translated-source"
            : "direct-source",
      supportStatusManuallySet: false,
      aiAssisted: false,
      translationUsed: Boolean(source.authenticatedTranslation),
      usedInConversation: false,
      notes: shouldSplit ? `Added from source panel as part ${index + 1} of ${parts.length}.` : "Added from source panel.",
    };
  });
};

const correctedSeedContent: Record<string, Partial<SourceItem>> = {
  "src-quran-15-9": {
    excerpt: "إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ",
  },
  "src-ikhlas": {
    excerpt: "قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ",
  },
  "src-baqara-163": {
    excerpt: "وَإِلَٰهُكُمْ إِلَٰهٌ وَاحِدٌ ۖ لَا إِلَٰهَ إِلَّا هُوَ الرَّحْمَٰنُ الرَّحِيمُ",
  },
  "src-maidah-73": {
    excerpt: "لَقَدْ كَفَرَ الَّذِينَ قَالُوا إِنَّ اللَّهَ ثَالِثُ ثَلَاثَةٍ ۘ وَمَا مِنْ إِلَٰهٍ إِلَّا إِلَٰهٌ وَاحِدٌ",
  },
  "src-fussilat-42": {
    excerpt: "لَا يَأْتِيهِ الْبَاطِلُ مِنْ بَيْنِ يَدَيْهِ وَلَا مِنْ خَلْفِهِ ۖ تَنْزِيلٌ مِنْ حَكِيمٍ حَمِيدٍ",
  },
  "src-nisa-124": {
    excerpt: "وَمَنْ يَعْمَلْ مِنَ الصَّالِحَاتِ مِنْ ذَكَرٍ أَوْ أُنْثَىٰ وَهُوَ مُؤْمِنٌ فَأُولَٰئِكَ يَدْخُلُونَ الْجَنَّةَ",
  },
  "src-prophethood-quran": {
    excerpt: "مَا كَانَ مُحَمَّدٌ أَبَا أَحَدٍ مِنْ رِجَالِكُمْ وَلَٰكِنْ رَسُولَ اللَّهِ وَخَاتَمَ النَّبِيِّينَ",
  },
};

const seedSourceCatalog = sourceItems.map((source) => ({
  ...source,
  ...correctedSeedContent[source.sourceId],
  sourceOrigin: source.sourceOrigin ?? "seed",
}));

const mergeSourceCatalog = (persistedSources?: SourceItem[]) => {
  const existing = persistedSources ?? [];
  const seededIds = new Set(seedSourceCatalog.map((source) => source.sourceId));
  const existingById = new Map(existing.map((source) => [source.sourceId, source]));

  const mergedSeedSources = seedSourceCatalog.map((seedSource) => {
    const persisted = existingById.get(seedSource.sourceId);
    return {
      ...persisted,
      ...seedSource,
      sourceOrigin: persisted?.sourceOrigin ?? seedSource.sourceOrigin ?? "seed",
      connectorId: persisted?.connectorId,
      connectorName: persisted?.connectorName,
    };
  });

  const customSources = existing.filter((source) => !seededIds.has(source.sourceId));
  return [...customSources, ...mergedSeedSources];
};

const topicSourceIds: Record<string, string[]> = {
  "Qur'an": ["src-quran-15-9", "src-fussilat-42", "src-quran-preservation-note", "src-birmingham-manuscript"],
  "Allah / Tawhid": ["src-baqara-163", "src-maidah-73", "src-ikhlas", "src-tawhid-note"],
  Sunnah: ["src-hadith-transmission", "src-hadith-isnad", "src-quran-15-9"],
  "Women and Family": ["src-nisa-124", "src-women-note"],
  Prophethood: ["src-prophethood-quran", "src-prophethood-note"],
  "Jihad and Misconceptions": ["src-jihad-note"],
  zzGeneral: ["src-baqara-163", "src-ikhlas", "src-tawhid-note"],
};

const recommendCatalogSources = (caseItem: CaseRecord, catalog: SourceItem[]): SourceRecommendation[] => {
  const preferredIds = topicSourceIds[caseItem.topic] ?? [];
  const preferred = preferredIds
    .map((sourceId) => catalog.find((source) => source.sourceId === sourceId))
    .filter((source): source is SourceItem => Boolean(source));

  if (preferred.length > 0) {
    return preferred.map((source) => ({
      source,
      reason:
        source.sourceLanguage === "Arabic"
          ? "Saved primary source already in the local source library."
          : "Saved supporting source already in the local source library.",
    }));
  }

  const queryTerms = `${caseItem.topic} ${caseItem.originalQuestion}`.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return catalog
    .map((source) => {
      const haystack = `${source.sourceTitle} ${source.excerpt} ${source.fullReference}`.toLowerCase();
      const score = queryTerms.reduce((total, term) => (haystack.includes(term) ? total + 1 : total), 0);
      return { source, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => ({
      source: entry.source,
      reason: "Matched against the saved local source library for this case.",
    }));
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  currentView: "home",
  navigationLabel: "Home",
  savedCases,
  activeTabs: sortTabs(activeCaseTabs),
  sourceItems: mergeSourceCatalog(),
  savedBites: responseBites,
  currentCaseId: sortTabs(activeCaseTabs)[0]?.caseId ?? null,
  workspaceBites: mapWorkspaceBites(savedCases),
  selectedSourceIds: {},
  recommendedSourcesByCase: {},
  similarMatches: [],
  structureSuggestionsByCase: {},
  saveMetadataByCase: saveMetadataSuggestions,
  translationModalOpen: false,
  translationSourceId: null,
  translationResult: null,
  selectedLibraryCaseId: null,
  searchTerm: "",
  isClassifying: false,
  isLoadingSimilar: false,
  isLoadingSources: false,
  isGeneratingStructure: false,
  isTranslating: false,
  draftForm: blankDraft,
  classificationDraft: blankClassification,

  setCurrentView: (view, label) => set({ currentView: view, navigationLabel: label ?? "Home" }),
  setSearchTerm: (term) => set({ searchTerm: term }),

  selectCase: (caseId) =>
    set((state) => {
      const caseItem = get().savedCases.find((entry) => entry.caseId === caseId);
      const existingTab = state.activeTabs.find((tab) => tab.caseId === caseId);
      const reactivatedTab =
        existingTab ??
        (caseItem
          ? {
              tabId: `tab-${caseId}`,
              caseId,
              tabTitle: caseItem.title,
              unsavedChangesFlag: false,
              lastActiveTimestamp: new Date().toISOString(),
            }
          : null);

      return {
        savedCases: state.savedCases.map((item) =>
          item.caseId === caseId ? { ...item, accessCount: (item.accessCount ?? 0) + 1 } : item,
        ),
        activeTabs: reactivatedTab
          ? sortTabs([
              ...state.activeTabs.filter((tab) => tab.caseId !== caseId),
              reactivatedTab,
            ])
          : state.activeTabs,
        currentCaseId: caseId,
        currentView: "workspace",
        navigationLabel: caseItem?.title ?? "Workspace",
      };
    }),

  updateDraftField: (field, value) =>
    set((state) => ({
      draftForm: {
        ...state.draftForm,
        [field]: value,
      },
    })),

  updateClassificationField: (field, value) =>
    set((state) => ({
      classificationDraft: {
        ...state.classificationDraft,
        [field]: value,
      },
    })),

  runClassification: async () => {
    const draft = get().draftForm;
    if (!draft.question.trim()) return;

    set({ isClassifying: true, isLoadingSimilar: true });
    const [classification, backendMatches, settings] = await Promise.all([
      backendApi.classifyCase(draft),
      backendApi.findSimilarCases(draft),
      backendApi.getSettings().catch(() => null),
    ]);
    const lists = getClassificationLists(settings);
    const normalizedClassification = normalizeClassificationToOptions(
      classification,
      lists.topics,
      lists.audience,
      lists.questions,
      lists.difficulties,
      lists.intents,
    );
    const localMatches = buildLocalSimilarMatches(draft, get().savedCases.filter((item) => item.status === "saved"), get().savedBites);
    const matches = backendMatches.length > 0 ? backendMatches : localMatches;
    set((state) => ({
      classificationDraft: normalizedClassification,
      similarMatches: matches,
      isClassifying: false,
      isLoadingSimilar: false,
      draftForm: {
        ...state.draftForm,
        caseName:
          state.draftForm.caseName?.trim() || mockAiService.suggestCaseName(state.draftForm, classification),
      },
    }));
  },

  createCaseFromDraft: async () => {
    const state = get();
    const question = state.draftForm.question.trim();
    if (!question) return;

    set({ isLoadingSimilar: true });
    const [settings, rawClassification] = await Promise.all([
      backendApi.getSettings().catch(() => null),
      state.classificationDraft.topic === "Awaiting classification"
        ? await backendApi.classifyCase(state.draftForm)
        : state.classificationDraft,
    ]);
    const lists = getClassificationLists(settings);
    const classification = normalizeClassificationToOptions(
      rawClassification,
      lists.topics,
      lists.audience,
      lists.questions,
      lists.difficulties,
      lists.intents,
    );
    const backendMatches = await backendApi.findSimilarCases(state.draftForm);
    const matches =
      backendMatches.length > 0
        ? backendMatches
        : buildLocalSimilarMatches(
            state.draftForm,
            get().savedCases.filter((item) => item.status === "saved"),
            get().savedBites,
          );

    const caseId = `case-${Date.now()}`;
    const createdDate = new Date().toISOString();
    const title =
      state.draftForm.caseName?.trim() || mockAiService.suggestCaseName(state.draftForm, classification);
    const caseItem: CaseRecord = {
      caseId,
      title,
      originalQuestion: question,
      contextNote: state.draftForm.contextNote,
      personName: state.draftForm.personName,
      platform: state.draftForm.platform,
      ...classification,
      createdDate,
      updatedDate: createdDate,
      status: "researching",
      relatedCaseIds: matches.map((match) => match.caseItem.caseId),
      sourceIdsUsed: [],
      responseBiteIds: [],
      confidenceStatus: "mixed",
    };

    const newTab: ActiveCaseTab = {
      tabId: `tab-${caseId}`,
      caseId,
      tabTitle: title,
      unsavedChangesFlag: true,
      lastActiveTimestamp: createdDate,
    };

    set((current) => ({
      savedCases: [caseItem, ...current.savedCases],
      activeTabs: sortTabs([newTab, ...current.activeTabs]),
      workspaceBites: {
        ...current.workspaceBites,
        [caseId]: [],
      },
      selectedSourceIds: {
        ...current.selectedSourceIds,
        [caseId]: [],
      },
      recommendedSourcesByCase: {
        ...current.recommendedSourcesByCase,
        [caseId]: [],
      },
      structureSuggestionsByCase: {
        ...current.structureSuggestionsByCase,
        [caseId]: [],
      },
      currentCaseId: caseId,
      currentView: "workspace",
      navigationLabel: "Research Workspace",
      similarMatches: matches,
      classificationDraft: classification,
      draftForm: blankDraft,
      isLoadingSimilar: false,
    }));
  },

  closeTab: (tabId) =>
    set((state) => {
      const closedTab = state.activeTabs.find((tab) => tab.tabId === tabId);
      if (closedTab?.isPinned) {
        return state;
      }

      const nextTabs = state.activeTabs.filter((tab) => tab.tabId !== tabId);
      const nextCurrentCaseId =
        state.currentCaseId === closedTab?.caseId ? (nextTabs[0]?.caseId ?? null) : state.currentCaseId;

      return {
        activeTabs: sortTabs(nextTabs),
        currentCaseId: nextCurrentCaseId,
        currentView: nextCurrentCaseId ? state.currentView : "home",
        navigationLabel: nextCurrentCaseId
          ? state.savedCases.find((item) => item.caseId === nextCurrentCaseId)?.title ?? state.navigationLabel
          : "Home",
      };
    }),

  togglePinTab: (tabId) =>
    set((state) => ({
      activeTabs: sortTabs(
        state.activeTabs.map((tab) => (tab.tabId === tabId ? { ...tab, isPinned: !tab.isPinned } : tab)),
      ),
    })),

  addSourceToWorkspace: (caseId, sourceId) =>
    set((state) => {
      const selected = state.selectedSourceIds[caseId] ?? [];
      if (selected.includes(sourceId)) return state;

      const source = state.sourceItems.find((item) => item.sourceId === sourceId);
      const existingBites = state.workspaceBites[caseId] ?? [];
      const nextOrder = existingBites.length + 1;

      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        sourceItems: state.sourceItems.map((item) =>
          item.sourceId === sourceId ? { ...item, accessCount: (item.accessCount ?? 0) + 1 } : item,
        ),
        selectedSourceIds: {
          ...state.selectedSourceIds,
          [caseId]: [...selected, sourceId],
        },
        workspaceBites: source
          ? {
              ...state.workspaceBites,
              [caseId]: [
                ...existingBites,
                ...buildBitesFromSource(source, caseId, nextOrder),
              ],
            }
          : state.workspaceBites,
      };
    }),

  addSavedBiteToWorkspace: (caseId, bite) =>
    set((state) => {
      const existingBites = state.workspaceBites[caseId] ?? [];
      const order = existingBites.length + 1;

      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: [...existingBites, cloneBiteForCase(bite, caseId, order)],
        },
      };
    }),

  updateWorkspaceBite: (caseId, biteId, changes) =>
    set((state) => {
      const isConversationUsageOnly =
        Object.keys(changes).length === 1 && Object.prototype.hasOwnProperty.call(changes, "usedInConversation");
      const nextWorkspaceBites = (state.workspaceBites[caseId] ?? []).map((bite) =>
        bite.biteId === biteId
          ? {
              ...bite,
              ...changes,
              supportStatusManuallySet: changes.supportStatus ? true : bite.supportStatusManuallySet,
            }
          : bite,
      );
      const caseIsSaved = state.savedCases.some((caseItem) => caseItem.caseId === caseId && caseItem.status === "saved");

      return {
        activeTabs: isConversationUsageOnly ? state.activeTabs : markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: nextWorkspaceBites,
        },
        savedBites: caseIsSaved
          ? [
              ...state.savedBites.filter((bite) => bite.caseId !== caseId),
              ...nextWorkspaceBites,
            ]
          : state.savedBites,
      };
    }),

  addEmptyBite: (caseId) =>
    set((state) => {
      const bites = state.workspaceBites[caseId] ?? [];
      const nextOrder = bites.length + 1;
      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: [
            ...bites,
            {
              biteId: createBiteId(caseId, "manual"),
              caseId,
              biteOrder: nextOrder,
              biteTitle: `New bite ${nextOrder}`,
              biteText: "",
              bitePurpose: "clarification",
              sourceCategory: "user",
              sourceLinks: [],
              supportStatus: "ai-assisted",
              supportStatusManuallySet: false,
              aiAssisted: true,
              translationUsed: false,
              usedInConversation: false,
            },
          ],
        },
      };
    }),

  moveBite: (caseId, biteId, direction) =>
    set((state) => {
      const bites = [...(state.workspaceBites[caseId] ?? [])];
      const index = bites.findIndex((bite) => bite.biteId === biteId);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= bites.length) {
        return state;
      }

      [bites[index], bites[swapIndex]] = [bites[swapIndex], bites[index]];
      const reordered = bites.map((bite, order) => ({ ...bite, biteOrder: order + 1 }));

      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: reordered,
        },
      };
    }),

  removeBite: (caseId, biteId) =>
    set((state) => {
      const currentBites = state.workspaceBites[caseId] ?? [];
      const removedBite = currentBites.find((bite) => bite.biteId === biteId);
      const remainingBites = currentBites
        .filter((bite) => bite.biteId !== biteId)
        .map((bite, index) => ({ ...bite, biteOrder: index + 1 }));

      const remainingSourceIds = new Set(remainingBites.flatMap((bite) => bite.sourceLinks));
      const nextSelectedSourceIds = (state.selectedSourceIds[caseId] ?? []).filter((sourceId) =>
        remainingSourceIds.has(sourceId),
      );

      if (!removedBite) {
        return state;
      }

      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: remainingBites,
        },
        selectedSourceIds: {
          ...state.selectedSourceIds,
          [caseId]: nextSelectedSourceIds,
        },
      };
    }),

  generateStructure: async (caseId) => {
    const caseItem = get().savedCases.find((entry) => entry.caseId === caseId);
    if (!caseItem) return;

    set({ isGeneratingStructure: true });
    try {
        const suggestions = normalizeStructureSuggestions(await backendApi.suggestStructure(
          {
            question: caseItem.originalQuestion,
            topic: caseItem.topic,
            contextNote: caseItem.contextNote,
          },
        ));

      set((state) => ({
        structureSuggestionsByCase: {
          ...state.structureSuggestionsByCase,
          [caseId]: suggestions,
        },
      }));
    } finally {
      set({ isGeneratingStructure: false });
    }
  },

  acceptStructureSuggestion: (caseId, suggestionIndex) =>
    set((state) => {
      const suggestions = state.structureSuggestionsByCase[caseId] ?? [];
      const suggestion = suggestions[suggestionIndex];
      if (!suggestion) {
        return state;
      }

      const existingBites = state.workspaceBites[caseId] ?? [];
      const nextOrder = existingBites.length + 1;

      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: [
            ...existingBites,
            {
              biteId: createBiteId(caseId, "suggested"),
              caseId,
              biteOrder: nextOrder,
              biteTitle: suggestion.biteTitle,
              biteText: suggestion.guidance,
              bitePurpose: suggestion.bitePurpose,
              sourceCategory: "other",
              sourceLinks: [],
              supportStatus: "ai-assisted",
              supportStatusManuallySet: false,
              aiAssisted: true,
              translationUsed: false,
              usedInConversation: false,
              notes: "Added from structure suggestion.",
            },
          ],
        },
        structureSuggestionsByCase: {
          ...state.structureSuggestionsByCase,
          [caseId]: suggestions.filter((_, index) => index !== suggestionIndex),
        },
      };
    }),

  clearStructureSuggestions: (caseId) =>
    set((state) => ({
      structureSuggestionsByCase: {
        ...state.structureSuggestionsByCase,
        [caseId]: [],
      },
    })),

  loadRecommendedSources: async (caseId) => {
    const caseItem = get().savedCases.find((entry) => entry.caseId === caseId);
    if (!caseItem) return;
    const recommendations = recommendCatalogSources(caseItem, get().sourceItems);

    set((state) => ({
      recommendedSourcesByCase: {
        ...state.recommendedSourcesByCase,
        [caseId]: recommendations,
      },
    }));
  },

  refreshSimilarMatches: async () => {
    const caseId = get().currentCaseId;
    const caseItem = get().savedCases.find((entry) => entry.caseId === caseId);
    if (!caseItem) return;

    set({ isLoadingSimilar: true });
    const backendMatches = await backendApi.findSimilarCases({
      question: caseItem.originalQuestion,
      contextNote: caseItem.contextNote,
      personName: caseItem.personName,
      platform: caseItem.platform,
    });
    const localMatches = buildLocalSimilarMatches(
      {
        question: caseItem.originalQuestion,
        contextNote: caseItem.contextNote,
        personName: caseItem.personName,
        platform: caseItem.platform,
      },
      get().savedCases.filter((item) => item.status === "saved"),
      get().savedBites,
    );
    set({ similarMatches: backendMatches.length > 0 ? backendMatches : localMatches, isLoadingSimilar: false });
  },

  assessConfidence: async (caseId) => {
    const bites = get().workspaceBites[caseId] ?? [];
    const statuses = await backendApi.assessConfidence(bites, get().sourceItems);

    set((state) => ({
      activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
      workspaceBites: {
        ...state.workspaceBites,
        [caseId]: (state.workspaceBites[caseId] ?? []).map((bite) => ({
          ...bite,
          supportStatus: bite.supportStatusManuallySet ? bite.supportStatus : statuses[bite.biteId] ?? bite.supportStatus,
        })),
      },
    }));
  },

  openTranslationModal: async (sourceId) => {
    const state = get();
    const caseId = state.currentCaseId;
    const recommended = caseId ? (state.recommendedSourcesByCase[caseId] ?? []).map((item) => item.source) : [];
    const selectedSource =
      state.sourceItems.find((item) => item.sourceId === sourceId) ??
      state.sourceItems.find((item) => caseId && (state.selectedSourceIds[caseId] ?? []).includes(item.sourceId)) ??
      recommended.find((item) => item.sourceLanguage === "Arabic") ??
      recommended[0] ??
      state.sourceItems[0];

    if (!selectedSource) return;

    if (selectedSource.translationAvailable && selectedSource.authenticatedTranslation) {
      set({
        isTranslating: false,
        translationModalOpen: true,
        translationSourceId: selectedSource.sourceId,
        translationResult: {
          sourceId: selectedSource.sourceId,
          sourceTitle: selectedSource.sourceTitle,
          sourceLinks: [selectedSource.sourceId],
          aiAssisted: false,
          originalText: selectedSource.excerpt,
          workingTranslation: selectedSource.authenticatedTranslation,
          alternatives: [],
          warning: selectedSource.translationResourceName
            ? `Using saved translation from ${selectedSource.translationResourceName}.`
            : "Using the saved translation already attached to this source.",
          targetLanguageCode: "en",
          targetLanguageLabel: "English",
        },
      });
      return;
    }

    set({
      isTranslating: false,
      translationModalOpen: true,
      translationSourceId: selectedSource.sourceId,
      translationResult: {
        sourceId: selectedSource.sourceId,
        sourceTitle: selectedSource.sourceTitle,
        sourceLinks: [selectedSource.sourceId],
        aiAssisted: true,
        originalText: selectedSource.excerpt,
        workingTranslation: "",
        alternatives: [],
        targetLanguageLabel: "English",
        targetLanguageCode: "en",
      },
    });
  },

  openTranslationForText: async (text, label, sourceLinks = [], aiAssisted = false, options) => {
    const executeNow = Boolean(options?.executeNow);
    const provisionalSourceId = `custom-${Date.now()}`;
    const targetLanguageLabel = options?.targetLanguageLabel ?? "English";
    const targetLanguageCode = options?.targetLanguageCode;

    set((state) => ({
      isTranslating: executeNow,
      translationModalOpen: true,
      translationSourceId: provisionalSourceId,
      translationResult: {
        sourceId: provisionalSourceId,
        sourceTitle: label,
        sourceLinks,
        aiAssisted,
        originalText: text,
        workingTranslation: executeNow ? state.translationResult?.workingTranslation ?? "" : "",
        alternatives: executeNow ? state.translationResult?.alternatives ?? [] : [],
        warning: undefined,
        targetLanguageLabel,
        targetLanguageCode,
      },
    }));

    if (!executeNow) {
      return;
    }

    try {
      const result = await backendApi.translateSource(
        {
          sourceId: provisionalSourceId,
          sourceType: "user-note",
          sourceTitle: label,
          sourceLanguage: "Arabic",
          excerpt: text,
          fullReference: label,
          trustLevel: "needs-review",
          translationAvailable: false,
          linkedBiteIds: [],
          sourceOrigin: "manual",
        },
        {
          targetLanguageCode,
          targetLanguageLabel,
        },
      );

      set({
        translationSourceId: result.sourceId,
        translationResult: result,
      });
    } catch (error) {
      set((state) => ({
        translationResult: state.translationResult
          ? {
              ...state.translationResult,
              workingTranslation: "",
              alternatives: [],
              warning: error instanceof Error ? error.message : "Translation failed.",
            }
          : state.translationResult,
      }));
      throw error;
    } finally {
      set({ isTranslating: false });
    }
  },

  closeTranslationModal: () =>
    set({
      isTranslating: false,
      translationModalOpen: false,
      translationSourceId: null,
      translationResult: null,
    }),

  insertTranslationIntoBites: (caseId, textOverride) =>
    set((state) => {
      const translation = state.translationResult;
      if (!translation) return state;
      const bites = state.workspaceBites[caseId] ?? [];
      const nextOrder = bites.length + 1;
      const inheritedSourceLinks = translation.sourceLinks?.length ? translation.sourceLinks : [translation.sourceId];
      const linkedSources = state.sourceItems.filter((source) => inheritedSourceLinks.includes(source.sourceId));
      const primaryLinkedSource =
        linkedSources.find((source) => source.sourceType === "quran" || source.sourceType === "hadith") ?? linkedSources[0];
      const hasPrimarySource = linkedSources.some(
        (source) => source.sourceType === "quran" || source.sourceType === "hadith",
      );
      const isCustomTranslationWithoutSources = translation.sourceId.startsWith("custom-") && linkedSources.length === 0;
      return {
        activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: [
            ...bites,
            {
              biteId: createBiteId(caseId, "translation"),
              caseId,
              biteOrder: nextOrder,
              biteTitle: translation.sourceTitle || "Translated support",
              biteText: textOverride ?? translation.workingTranslation,
              bitePurpose: "evidence",
              sourceCategory: isCustomTranslationWithoutSources
                ? "user"
                : hasPrimarySource
                  ? linkedSources.some((source) => source.sourceType === "hadith")
                    ? "hadith"
                    : "quran"
                  : "other",
              sourceSecondaryLabel: primaryLinkedSource ? getTranslationResourceLabel(primaryLinkedSource) : undefined,
              translationResourceName: primaryLinkedSource?.translationResourceName,
              sourceTafsirLabel: primaryLinkedSource ? getTafsirResourceLabel(primaryLinkedSource) : undefined,
              tafsirResourceName: primaryLinkedSource?.tafsirResourceName,
              sourceLinks: inheritedSourceLinks,
              supportStatus: isCustomTranslationWithoutSources
                ? "weak-support"
                : hasPrimarySource
                  ? "direct-source"
                  : "translated-source",
              supportStatusManuallySet: false,
              aiAssisted: Boolean(translation.aiAssisted),
              translationUsed: true,
              usedInConversation: false,
              notes: translation.warning,
            },
          ],
        },
        translationModalOpen: false,
        translationSourceId: null,
        translationResult: null,
      };
    }),

  openSaveReview: async (caseId) => {
    const caseItem = get().savedCases.find((entry) => entry.caseId === caseId);
    if (!caseItem) return;
    const bites = get().workspaceBites[caseId] ?? [];
    const suggestion = await backendApi.suggestMetadata(caseItem, bites);
    set((state) => ({
      currentView: "save-review",
      navigationLabel: "Save & Catalog Review",
      saveMetadataByCase: {
        ...state.saveMetadataByCase,
        [caseId]: suggestion,
      },
    }));
  },

  confirmSaveCase: (caseId) =>
    set((state) => ({
      savedCases: state.savedCases.map((caseItem) =>
        caseItem.caseId === caseId
          ? {
              ...caseItem,
              status: "saved",
              updatedDate: new Date().toISOString(),
              responseBiteIds: (state.workspaceBites[caseId] ?? []).map((bite) => bite.biteId),
              sourceIdsUsed: state.selectedSourceIds[caseId] ?? [],
            }
          : caseItem,
      ),
      activeTabs: clearCaseTabUnsaved(state.activeTabs, caseId),
      currentView: "workspace",
      navigationLabel: state.savedCases.find((item) => item.caseId === caseId)?.title ?? "Research Workspace",
    })),

  updateCaseDetails: (caseId, changes) =>
    set((state) => ({
      activeTabs: markCaseTabUnsaved(
        state.activeTabs.map((tab) =>
          tab.caseId === caseId && changes.title ? { ...tab, tabTitle: changes.title } : tab,
        ),
        caseId,
      ),
      savedCases: state.savedCases.map((caseItem) =>
        caseItem.caseId === caseId
          ? {
              ...caseItem,
              ...changes,
              updatedDate: new Date().toISOString(),
            }
          : caseItem,
      ),
      navigationLabel:
        state.currentCaseId === caseId && changes.title ? changes.title : state.navigationLabel,
    })),

  updateCaseTags: (caseId, tags) =>
    set((state) => ({
      activeTabs: markCaseTabUnsaved(state.activeTabs, caseId),
      saveMetadataByCase: {
        ...state.saveMetadataByCase,
        [caseId]: {
          ...(state.saveMetadataByCase[caseId] ?? {
            suggestedTitle: state.savedCases.find((item) => item.caseId === caseId)?.title ?? "Untitled case",
            tags: [],
            audienceType: state.savedCases.find((item) => item.caseId === caseId)?.audienceType ?? "",
            questionType: state.savedCases.find((item) => item.caseId === caseId)?.questionType ?? "",
            relatedThemes: [],
            summarySnippet: "",
          }),
          tags,
        },
      },
    })),

  saveSourceToLibrary: (source) =>
    set((state) => {
      const normalizedSource: SourceItem = {
        ...source,
        sourceOrigin:
          source.sourceOrigin ??
          (source.connectorId || source.connectorName ? "connector" : "manual"),
      };
      return {
        sourceItems: state.sourceItems.some((item) => item.sourceId === normalizedSource.sourceId)
          ? state.sourceItems.map((item) => (item.sourceId === normalizedSource.sourceId ? { ...item, ...normalizedSource } : item))
          : [normalizedSource, ...state.sourceItems],
      };
    }),

  removeSourceFromLibrary: (sourceId) =>
    set((state) => ({
      sourceItems: state.sourceItems.filter((item) => item.sourceId !== sourceId),
      selectedSourceIds: Object.fromEntries(
        Object.entries(state.selectedSourceIds).map(([caseId, sourceIds]) => [
          caseId,
          sourceIds.filter((id) => id !== sourceId),
        ]),
      ),
      recommendedSourcesByCase: Object.fromEntries(
        Object.entries(state.recommendedSourcesByCase).map(([caseId, recommendations]) => [
          caseId,
          recommendations.filter((item) => item.source.sourceId !== sourceId),
        ]),
      ),
    })),

  openLibrary: () =>
    set({
      currentView: "library",
      navigationLabel: "Case Library",
    }),

  openCaseDetail: (caseId) =>
    set((state) => ({
      savedCases: state.savedCases.map((item) =>
        item.caseId === caseId ? { ...item, accessCount: (item.accessCount ?? 0) + 1 } : item,
      ),
      currentView: "case-detail",
      navigationLabel: state.savedCases.find((item) => item.caseId === caseId)?.title ?? "Saved Case Detail",
      selectedLibraryCaseId: caseId,
    })),

  deleteSavedCase: (caseId) =>
    set((state) => {
      const remainingCases = state.savedCases.filter((caseItem) => caseItem.caseId !== caseId);
      const remainingTabs = sortTabs(state.activeTabs.filter((tab) => tab.caseId !== caseId));
      const { [caseId]: _removedBites, ...remainingWorkspaceBites } = state.workspaceBites;
      const { [caseId]: _removedSelectedSources, ...remainingSelectedSourceIds } = state.selectedSourceIds;
      const { [caseId]: _removedRecommendations, ...remainingRecommendedSources } = state.recommendedSourcesByCase;
      const { [caseId]: _removedStructure, ...remainingStructureSuggestions } = state.structureSuggestionsByCase;
      const { [caseId]: _removedMetadata, ...remainingSaveMetadata } = state.saveMetadataByCase;

      const nextCurrentCaseId = state.currentCaseId === caseId ? (remainingTabs[0]?.caseId ?? null) : state.currentCaseId;
      const nextView =
        state.currentView === "case-detail" && state.selectedLibraryCaseId === caseId
          ? "library"
          : state.currentView === "workspace" && state.currentCaseId === caseId
            ? (nextCurrentCaseId ? "workspace" : "home")
            : state.currentView;

      return {
        savedCases: remainingCases,
        activeTabs: remainingTabs,
        workspaceBites: remainingWorkspaceBites,
        selectedSourceIds: remainingSelectedSourceIds,
        recommendedSourcesByCase: remainingRecommendedSources,
        structureSuggestionsByCase: remainingStructureSuggestions,
        saveMetadataByCase: remainingSaveMetadata,
        currentCaseId: nextCurrentCaseId,
        selectedLibraryCaseId: state.selectedLibraryCaseId === caseId ? null : state.selectedLibraryCaseId,
        currentView: nextView,
        navigationLabel:
          nextView === "library"
            ? "Case Library"
            : nextView === "home"
              ? "Home"
              : nextCurrentCaseId
                ? remainingCases.find((item) => item.caseId === nextCurrentCaseId)?.title ?? state.navigationLabel
                : state.navigationLabel,
      };
    }),

  reuseFullCaseSequence: (sourceCaseId, targetCaseId) =>
    set((state) => {
      const sourceBites = (state.workspaceBites[sourceCaseId] ??
        state.savedBites.filter((bite) => bite.caseId === sourceCaseId)
      ).sort((a, b) => a.biteOrder - b.biteOrder);
      const targetBites = state.workspaceBites[targetCaseId] ?? [];
      const cloned = sourceBites.map((bite, index) => cloneBiteForCase(bite, targetCaseId, targetBites.length + index + 1));
      return {
        workspaceBites: {
          ...state.workspaceBites,
          [targetCaseId]: [...targetBites, ...cloned],
        },
        currentCaseId: targetCaseId,
        currentView: "workspace",
        navigationLabel: state.savedCases.find((item) => item.caseId === targetCaseId)?.title ?? "Research Workspace",
      };
    }),

  duplicateCaseFromLibrary: (sourceCaseId) =>
    set((state) => {
      const sourceCase = state.savedCases.find((item) => item.caseId === sourceCaseId);
      if (!sourceCase) {
        return state;
      }

      const sourceBites = (state.workspaceBites[sourceCaseId] ??
        state.savedBites.filter((bite) => bite.caseId === sourceCaseId)
      ).sort((a, b) => a.biteOrder - b.biteOrder);

      const caseId = `case-${Date.now()}`;
      const timestamp = new Date().toISOString();
      const duplicatedCase: CaseRecord = {
        ...sourceCase,
        caseId,
        title: `${sourceCase.title} copy`,
        createdDate: timestamp,
        updatedDate: timestamp,
        status: "researching",
        responseBiteIds: [],
        sourceIdsUsed: [...sourceCase.sourceIdsUsed],
        confidenceStatus: "mixed",
      };

      const duplicatedBites = sourceBites.map((bite, index) => cloneBiteForCase(bite, caseId, index + 1));
      const duplicatedTab: ActiveCaseTab = {
        tabId: `tab-${caseId}`,
        caseId,
        tabTitle: duplicatedCase.title,
        unsavedChangesFlag: true,
        lastActiveTimestamp: timestamp,
      };

      return {
        savedCases: [duplicatedCase, ...state.savedCases],
        activeTabs: sortTabs([duplicatedTab, ...state.activeTabs]),
        currentCaseId: caseId,
        currentView: "workspace",
        navigationLabel: duplicatedCase.title,
        workspaceBites: {
          ...state.workspaceBites,
          [caseId]: duplicatedBites,
        },
        selectedSourceIds: {
          ...state.selectedSourceIds,
          [caseId]: [...sourceCase.sourceIdsUsed],
        },
        structureSuggestionsByCase: {
          ...state.structureSuggestionsByCase,
          [caseId]: [],
        },
        recommendedSourcesByCase: {
          ...state.recommendedSourcesByCase,
          [caseId]: state.recommendedSourcesByCase[sourceCaseId] ?? [],
        },
        saveMetadataByCase: {
          ...state.saveMetadataByCase,
          [caseId]: state.saveMetadataByCase[sourceCaseId]
            ? {
                ...state.saveMetadataByCase[sourceCaseId],
                suggestedTitle: `${state.saveMetadataByCase[sourceCaseId].suggestedTitle} copy`,
              }
            : {
                suggestedTitle: `${sourceCase.title} copy`,
                tags: [],
                audienceType: sourceCase.audienceType,
                questionType: sourceCase.questionType,
                relatedThemes: [sourceCase.topic, sourceCase.likelyIntent, sourceCase.difficulty],
                summarySnippet: duplicatedBites[0]?.biteText ?? "",
              },
        },
        similarMatches: [],
      };
    }),

  hydrateFromBackendSnapshot: ({ savedCases: backendCases, savedBites: backendBites, sourceRecords }) =>
    set((state) => {
      const protectedCaseIds = new Set([
        ...state.activeTabs.filter((tab) => tab.unsavedChangesFlag).map((tab) => tab.caseId),
        ...state.savedCases.filter((caseItem) => caseItem.status !== "saved").map((caseItem) => caseItem.caseId),
      ]);
      const localCasesById = new Map(state.savedCases.map((caseItem) => [caseItem.caseId, caseItem]));
      const backendCasesById = new Map(backendCases.map((caseItem) => [caseItem.caseId, caseItem]));
      const mergedCaseIds = new Set([...localCasesById.keys(), ...backendCasesById.keys()]);
      const mergedCases = [...mergedCaseIds]
        .map((caseId) => {
          const localCase = localCasesById.get(caseId);
          const backendCase = backendCasesById.get(caseId);
          if (!localCase) return backendCase ?? null;
          if (!backendCase) return localCase;
          if (protectedCaseIds.has(caseId)) return localCase;
          return new Date(backendCase.updatedDate).getTime() >= new Date(localCase.updatedDate).getTime()
            ? backendCase
            : localCase;
        })
        .filter((caseItem): caseItem is CaseRecord => Boolean(caseItem));

      const localBitesByCase = new Map<string, ResponseBite[]>();
      for (const bite of state.savedBites) {
        if (!localBitesByCase.has(bite.caseId)) {
          localBitesByCase.set(bite.caseId, []);
        }
        localBitesByCase.get(bite.caseId)?.push(bite);
      }
      const backendBitesByCase = new Map<string, ResponseBite[]>();
      for (const bite of backendBites) {
        if (!backendBitesByCase.has(bite.caseId)) {
          backendBitesByCase.set(bite.caseId, []);
        }
        backendBitesByCase.get(bite.caseId)?.push(bite);
      }
      const mergedBiteCaseIds = new Set([...localBitesByCase.keys(), ...backendBitesByCase.keys()]);
      const mergedSavedBites = [...mergedBiteCaseIds].flatMap((caseId) => {
        if (protectedCaseIds.has(caseId)) {
          return localBitesByCase.get(caseId) ?? backendBitesByCase.get(caseId) ?? [];
        }
        return backendBitesByCase.get(caseId) ?? localBitesByCase.get(caseId) ?? [];
      });

      const localSourcesById = new Map(state.sourceItems.map((source) => [source.sourceId, source]));
      const backendSourcesById = new Map(sourceRecords.map((source) => [source.sourceId, source]));
      const mergedSourceIds = new Set([...localSourcesById.keys(), ...backendSourcesById.keys()]);
      const mergedSources = [...mergedSourceIds]
        .map((sourceId) => backendSourcesById.get(sourceId) ?? localSourcesById.get(sourceId))
        .filter((source): source is SourceItem => Boolean(source));

      const normalizedSaved = normalizeCasesAndBites(mergedCases, mergedSavedBites);
      const restoredWorkspaceBites = mapWorkspaceBitesFromSavedBites(normalizedSaved.cases, normalizedSaved.bites);
      const localWorkspaceBites = normalizeWorkspaceBiteMap(state.workspaceBites);
      const mergedWorkspaceBites = {
        ...restoredWorkspaceBites,
        ...Object.fromEntries(
          [...protectedCaseIds].map((caseId) => [caseId, localWorkspaceBites[caseId] ?? restoredWorkspaceBites[caseId] ?? []]),
        ),
      };
      const normalizedMergedWorkspaceBites = normalizeWorkspaceBiteMap(mergedWorkspaceBites);

      const mergedSelectedSourceIds = {
        ...Object.fromEntries(normalizedSaved.cases.map((caseItem) => [caseItem.caseId, caseItem.sourceIdsUsed ?? []])),
        ...state.selectedSourceIds,
      };

      return {
        savedCases: syncCasesToWorkspaceBites(normalizedSaved.cases, normalizedMergedWorkspaceBites),
        savedBites: normalizedSaved.bites,
        sourceItems: mergedSources,
        workspaceBites: normalizedMergedWorkspaceBites,
        selectedSourceIds: mergedSelectedSourceIds,
        activeTabs: sortTabs(
          state.activeTabs.map((tab) => {
            if (protectedCaseIds.has(tab.caseId)) {
              return tab;
            }
            const syncedCase = normalizedSaved.cases.find((caseItem) => caseItem.caseId === tab.caseId);
            return syncedCase ? { ...tab, tabTitle: syncedCase.title } : tab;
          }),
        ),
      };
    }),
    }),
    {
      name: "dawah-desk-v1",
      version: 7,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: unknown) => {
        const state = (persistedState as Partial<AppState>) ?? {};
        const normalizedWorkspaceBites = normalizeWorkspaceBiteMap(state.workspaceBites ?? {});
        const nextCases = syncCasesToWorkspaceBites(state.savedCases ?? savedCases, normalizedWorkspaceBites);
        const nextTabs = sortTabs(state.activeTabs ?? activeCaseTabs);
        return {
          ...state,
          savedCases: nextCases,
          activeTabs: nextTabs,
          sourceItems: state.sourceItems ?? [],
          currentCaseId: state.currentCaseId ?? nextTabs[0]?.caseId ?? null,
          workspaceBites:
            Object.keys(normalizedWorkspaceBites).length > 0
              ? normalizedWorkspaceBites
              : mapWorkspaceBites(nextCases),
          selectedSourceIds: state.selectedSourceIds ?? {},
          recommendedSourcesByCase: state.recommendedSourcesByCase ?? {},
          structureSuggestionsByCase: state.structureSuggestionsByCase ?? {},
          saveMetadataByCase: state.saveMetadataByCase ?? saveMetadataSuggestions,
          selectedLibraryCaseId: state.selectedLibraryCaseId ?? null,
        };
      },
      partialize: (state) => ({
        savedCases: state.savedCases,
        activeTabs: state.activeTabs,
        sourceItems: state.sourceItems,
        currentCaseId: state.currentCaseId,
        workspaceBites: state.workspaceBites,
        selectedSourceIds: state.selectedSourceIds,
        recommendedSourcesByCase: state.recommendedSourcesByCase,
        structureSuggestionsByCase: state.structureSuggestionsByCase,
        saveMetadataByCase: state.saveMetadataByCase,
        selectedLibraryCaseId: state.selectedLibraryCaseId,
      }),
    },
  ),
);
