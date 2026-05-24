import {
  CaseClassification,
  CaseDraftInput,
  CaseRecord,
  ResponseBite,
  SimilarCaseMatch,
  SourceItem,
  SourceRecommendation,
  SourceType,
  StructureSuggestion,
  SupportStatus,
  TranslationResult,
} from "@/types";
import { responseBites, savedCases, sourceItems } from "@/data/seed";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const classifyByKeywords = (question: string): CaseClassification => {
  const q = question.toLowerCase();

  if (q.includes("reading") || q.includes("qira") || q.includes("preserv")) {
    return {
      topic: "Qur'an",
      audienceType: "Christian / Jesus-focused",
      questionType: "Textual",
      difficulty: "Advanced",
      likelyIntent: "Critical inquiry",
    };
  }

  if (q.includes("trinity") || q.includes("three persons") || q.includes("one god")) {
    return {
      topic: "Allah / Tawhid",
      audienceType: "Christian / Jesus-focused",
      questionType: "Theological",
      difficulty: "Medium",
      likelyIntent: "Seek understanding",
    };
  }

  if (q.includes("hadith") || q.includes("sunnah")) {
    return {
      topic: "Sunnah",
      audienceType: "Non-Muslim / Skeptic",
      questionType: "Historical",
      difficulty: "Advanced",
      likelyIntent: "Critical inquiry",
    };
  }

  if (q.includes("women")) {
    return {
      topic: "Women and Family",
      audienceType: "Critical / Challenging",
      questionType: "Ethical / Social",
      difficulty: "Medium",
      likelyIntent: "Challenge",
    };
  }

  if (q.includes("prophet")) {
    return {
      topic: "Prophethood",
      audienceType: "Seeker",
      questionType: "Theological",
      difficulty: "Medium",
      likelyIntent: "Seek understanding",
    };
  }

  if (q.includes("jihad")) {
    return {
      topic: "Jihad and Misconceptions",
      audienceType: "Critical / Challenging",
      questionType: "Ethical / Social",
      difficulty: "Hard",
      likelyIntent: "Challenge",
    };
  }

  return {
    topic: "zzGeneral",
    audienceType: "General",
    questionType: "Clarification",
    difficulty: "Medium",
    likelyIntent: "Needs review",
  };
};

const scoreCase = (caseItem: CaseRecord, draft: CaseDraftInput, classification: CaseClassification) => {
  const question = draft.question.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (caseItem.topic === classification.topic) {
    score += 45;
    reasons.push("same topic");
  }

  if (caseItem.audienceType === classification.audienceType) {
    score += 20;
    reasons.push("same audience type");
  }

  if (caseItem.questionType === classification.questionType) {
    score += 15;
    reasons.push("same objection pattern");
  }

  const sharedWords = question
    .split(/\W+/)
    .filter((word) => word.length > 4 && caseItem.originalQuestion.toLowerCase().includes(word));
  if (sharedWords.length > 0) {
    score += Math.min(sharedWords.length * 5, 20);
    reasons.push("similar wording");
  }

  return { score, reasons };
};

const sourceIdsByTopic: Record<string, string[]> = {
  "Qur'an": [
    "src-quran-15-9",
    "src-quran-preservation-note",
    "src-birmingham-manuscript",
  ],
  "Allah / Tawhid": [
    "src-ikhlas",
    "src-tawhid-note",
    "src-quran-15-9",
  ],
  Sunnah: [
    "src-hadith-transmission",
    "src-hadith-isnad",
    "src-quran-15-9",
  ],
  "Women and Family": [
    "src-nisa-124",
    "src-women-note",
    "src-ikhlas",
  ],
  Prophethood: [
    "src-prophethood-quran",
    "src-prophethood-note",
    "src-quran-15-9",
  ],
  "Jihad and Misconceptions": [
    "src-jihad-note",
    "src-quran-15-9",
    "src-ikhlas",
  ],
  zzGeneral: [
    "src-quran-15-9",
    "src-ikhlas",
    "src-tawhid-note",
  ],
};

const fallbackSourceIds = [
  "src-quran-15-9",
  "src-ikhlas",
  "src-quran-preservation-note",
  "src-tawhid-note",
];

const semanticTermMap: Record<string, string[]> = {
  preservation: ["qiraat", "readings", "manuscript", "transmission", "text", "quran"],
  qiraat: ["preservation", "readings", "recitation", "canonical"],
  trinity: ["tawhid", "oneness", "god", "divine"],
  tawhid: ["trinity", "oneness", "ikhlas", "divine"],
  hadith: ["isnad", "matn", "transmission", "verification", "report"],
  isnad: ["hadith", "matn", "verification", "chain"],
  women: ["dignity", "nisa", "rights", "accountability"],
  prophet: ["prophethood", "revelation", "guidance", "messenger"],
  prophethood: ["prophet", "revelation", "guidance", "messenger"],
  jihad: ["struggle", "defense", "aggression", "ethical"],
  defense: ["jihad", "aggression", "ethical"],
};

const sourceTypeByTab: Record<"Quran" | "Sunnah", SourceType> = {
  Quran: "quran",
  Sunnah: "hadith",
};

const getSemanticTerms = (query: string, caseQuestion?: string) => {
  const baseTerms = `${query} ${caseQuestion ?? ""}`
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const expanded = new Set(baseTerms);

  baseTerms.forEach((term) => {
    (semanticTermMap[term] ?? []).forEach((related) => expanded.add(related));
  });

  return [...expanded];
};

export const mockAiService = {
  suggestCaseName(draft: CaseDraftInput, classification?: CaseClassification): string {
    const trimmed = draft.question.trim();
    if (!trimmed) return "New case";

    if (classification?.topic === "Qur'an") {
      return "Qur'an readings and preservation";
    }
    if (classification?.topic === "Allah / Tawhid") {
      return "Trinity question response";
    }
    if (classification?.topic === "Sunnah") {
      return "Sunnah reliability objection";
    }

    const shortened = trimmed.replace(/\s+/g, " ");
    return shortened.length > 48 ? `${shortened.slice(0, 48)}...` : shortened;
  },

  async classifyCase(draft: CaseDraftInput): Promise<CaseClassification> {
    await sleep(180);
    return classifyByKeywords(draft.question);
  },

  async quickAssist(prompt: string): Promise<{ text: string }> {
    await sleep(180);
    return {
      text: `Mock Local AI is active. Quick AIssist received:\n\n${prompt.trim()}\n\nSwitch to a live provider for a real model response.`,
    };
  },

  async findSimilarCases(draft: CaseDraftInput): Promise<SimilarCaseMatch[]> {
    await sleep(220);
    const classification = classifyByKeywords(draft.question);

    return savedCases
      .map((caseItem) => {
        const { score, reasons } = scoreCase(caseItem, draft, classification);
        return {
          caseItem,
          matchScore: score,
          reasons,
          matchingBites: responseBites.filter((bite) => caseItem.responseBiteIds.includes(bite.biteId)),
        };
      })
      .filter((item) => item.matchScore > 25)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);
  },

  async recommendSources(draft: CaseDraftInput): Promise<SourceRecommendation[]> {
    await sleep(200);
    const classification = classifyByKeywords(draft.question);
    const recommendedIds = sourceIdsByTopic[classification.topic] ?? fallbackSourceIds;

    return recommendedIds
      .map((sourceId) => sourceItems.find((source) => source.sourceId === sourceId))
      .filter((source): source is (typeof sourceItems)[number] => Boolean(source))
      .map((source) => ({
        source,
        reason:
          source.sourceLanguage === "Arabic"
            ? "Primary-language support that can be translated only if needed."
            : `Recommended for ${classification.topic.toLowerCase()} in this mock case flow.`,
      }));
  },

  searchSourcesSemantic(
    query: string,
    sources: SourceItem[],
    tab: "Quran" | "Sunnah",
    caseQuestion?: string,
  ): SourceItem[] {
    const semanticTerms = getSemanticTerms(query, caseQuestion);
    const requiredType = sourceTypeByTab[tab];

    return sources
      .filter((source) => source.sourceType === requiredType)
      .map((source) => {
        const haystack = `${source.sourceTitle} ${source.excerpt} ${source.fullReference}`.toLowerCase();
        const score = semanticTerms.reduce((total, term) => {
          if (haystack.includes(term)) {
            return total + (source.sourceTitle.toLowerCase().includes(term) ? 5 : 2);
          }
          return total;
        }, 0);

        return { source, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.source);
  },

  async translateSource(source: SourceItem): Promise<TranslationResult> {
    await sleep(120);
    return {
      sourceId: source.sourceId,
      sourceTitle: source.sourceTitle,
      originalText: source.excerpt,
      workingTranslation: "",
      alternatives: [],
      warning: "Mock Local AI does not provide production translation output. Use a live backend AI provider or Google fallback.",
    };
  },

  async suggestSaveMetadata(caseItem: CaseRecord, bites: ResponseBite[]) {
    await sleep(150);
    const firstBite = bites[0]?.biteText ?? "";
    return {
      suggestedTitle: caseItem.title,
      tags: [caseItem.topic, caseItem.audienceType, caseItem.questionType].filter(Boolean),
      audienceType: caseItem.audienceType,
      questionType: caseItem.questionType,
      relatedThemes: [caseItem.topic, caseItem.likelyIntent, caseItem.difficulty],
      duplicateWarning: caseItem.relatedCaseIds.length
        ? "Similar saved material exists. Review duplicates before confirming save."
        : undefined,
      summarySnippet: firstBite || "Short bite-based response saved for future reuse.",
    };
  },

  async suggestResponseStructure(
    draft: CaseDraftInput,
  ): Promise<StructureSuggestion[]> {
    await sleep(180);
    const classification = classifyByKeywords(draft.question);

    return [
      {
        biteTitle: "Opening acknowledgment",
        bitePurpose: "opening",
        guidance: `It is understandable to ask this about ${classification.topic.toLowerCase()}, and the best place to start is by separating the common assumption from what Islam is actually teaching.`,
      },
      {
        biteTitle: "Core distinction",
        bitePurpose: "key-claim",
        guidance: "The key point is that this issue should be understood in its proper context, not through a simplified or isolated reading.",
      },
      {
        biteTitle: "Source-grounded support",
        bitePurpose: "evidence",
        guidance: "You can support this clearly by pairing one primary Arabic source with one reliable English rendering or explanation.",
      },
      {
        biteTitle: "Clarification and invitation",
        bitePurpose: "invitation",
        guidance: "If you want, we can look at the main source text together and go through it step by step instead of leaving it at a summary.",
      },
    ];
  },

  async assessConfidence(
    bites: ResponseBite[],
    sourceCatalog: SourceItem[] = [],
  ): Promise<Record<string, SupportStatus>> {
    await sleep(150);

    return Object.fromEntries(
      bites.map((bite) => {
        const linkedSources = sourceCatalog.filter((source) => bite.sourceLinks.includes(source.sourceId));
        const hasPrimarySource = linkedSources.some(
          (source) => source.sourceType === "quran" || source.sourceType === "hadith",
        );
        const hasCustomOnlySource = bite.sourceLinks.some((sourceId) => sourceId.startsWith("custom-"));
        if (bite.sourceLinks.length === 0) {
          return [bite.biteId, "missing-support"];
        }
        if (hasPrimarySource) {
          return [bite.biteId, "direct-source"];
        }
        if (bite.translationUsed && hasCustomOnlySource) {
          return [bite.biteId, "weak-support"];
        }
        if (bite.translationUsed) {
          return [bite.biteId, "translated-source"];
        }
        if (bite.aiAssisted && bite.sourceLinks.length > 0) {
          return [bite.biteId, "ai-assisted"];
        }
        return [bite.biteId, "direct-source"];
      }),
    );
  },
};
