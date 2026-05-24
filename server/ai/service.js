import { createAIProviderAdapter, resolveProviderModel } from "./registry.js";

const allowedAudienceTypes = [
  "General",
  "Seeker",
  "Christian / Jesus-focused",
  "Jewish",
  "Non-Muslim / Interfaith",
  "Skeptic / Atheist",
  "Critical / Challenging",
  "Muslim / Doubting",
];

const allowedQuestionTypes = [
  "Clarification",
  "Comparative",
  "Evidential",
  "Textual",
  "Theological",
  "Historical",
  "Ethical / Social",
  "Challenging / Critical",
];

const allowedDifficulty = ["Easy", "Medium", "Advanced", "Hard"];
const allowedLikelyIntent = [
  "Seek understanding",
  "Seeking proof",
  "Seeking conviction",
  "General curiosity",
  "Clarification",
  "Challenge",
  "Critical inquiry",
  "Personal guidance",
  "Needs review",
];

const allowedTopics = (state) =>
  state.settings?.general?.topicsList?.length
    ? state.settings.general.topicsList
    : [
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
      ];

const classifyByKeywords = (question = "") => {
  const q = String(question).toLowerCase();
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
      audienceType: "Skeptic / Atheist",
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

export const scoreSimilarCases = (draft, state) => {
  const classification = classifyByKeywords(draft.question);
  const query = `${draft.question ?? ""} ${draft.contextNote ?? ""} ${draft.personName ?? ""} ${draft.platform ?? ""}`.toLowerCase();
  const threshold = Number(state.settings?.general?.similarityThreshold ?? 0.45);
  const minimumScore = Math.round(threshold * 100);

  return state.savedCases
    .map((caseItem) => {
      let score = 0;
      const reasons = [];

      if (caseItem.topic === classification.topic) {
        score += 40;
        reasons.push("same topic");
      }

      if (caseItem.audienceType === classification.audienceType) {
        score += 20;
        reasons.push("same audience type");
      }

      const sharedWords = query
        .split(/\W+/)
        .filter((word) => word.length > 4 && caseItem.originalQuestion.toLowerCase().includes(word));

      if (sharedWords.length > 0) {
        score += Math.min(sharedWords.length * 6, 24);
        reasons.push("similar wording");
      }

      return {
        caseItem,
        matchScore: score,
        reasons,
        matchingBites: state.savedBites.filter((bite) => bite.caseId === caseItem.caseId),
      };
    })
    .filter((match) => match.matchScore >= minimumScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
};

const suggestStructureHeuristically = ({ question, selectedSources = [] }) => {
  const classification = classifyByKeywords(question);
  return [
    {
      biteTitle: "Opening acknowledgment",
      bitePurpose: "opening",
      guidance: `Acknowledge why the ${classification.topic.toLowerCase()} question feels reasonable before correcting it.`,
    },
    {
      biteTitle: "Core distinction",
      bitePurpose: "key-claim",
      guidance: "State the main distinction clearly and keep it short enough for chat-based reuse.",
    },
    {
      biteTitle: "Source-grounded support",
      bitePurpose: "evidence",
      guidance: `Tie the answer to ${selectedSources.length > 0 ? "selected sources" : "one primary and one approved source"} for traceability.`,
    },
  ];
};

const assessConfidenceHeuristically = ({ bites = [], sourceCatalog = [] }, state) =>
  Object.fromEntries(
    bites.map((bite) => {
      const externalRecords = sourceCatalog.map((source) => ({
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        trustTier: source.sourceType === "quran" || source.sourceType === "hadith" ? 1 : source.trustLevel === "medium" ? 2 : 3,
      }));
      const allRecords = [...state.sourceRecords, ...externalRecords];
      const linkedSources = allRecords.filter((record) => bite.sourceLinks.includes(record.sourceId));
      const hasPrimary = linkedSources.some((record) => record.trustTier === 1);
      if (bite.sourceLinks.length === 0) return [bite.biteId, "missing-support"];
      if (hasPrimary) return [bite.biteId, "direct-source"];
      if (bite.translationUsed) return [bite.biteId, "translated-source"];
      if (bite.aiAssisted) return [bite.biteId, "ai-assisted"];
      return [bite.biteId, "weak-support"];
    }),
  );

const suggestMetadataHeuristically = ({ caseItem, bites }) => ({
  suggestedTitle: caseItem.title,
  tags: [caseItem.topic, caseItem.audienceType, caseItem.questionType].filter(Boolean),
  audienceType: caseItem.audienceType,
  questionType: caseItem.questionType,
  relatedThemes: [caseItem.topic, caseItem.likelyIntent, caseItem.difficulty].filter(Boolean),
  duplicateWarning: caseItem.relatedCaseIds?.length ? "Similar saved material exists. Review duplicates before confirming save." : undefined,
  summarySnippet: bites?.[0]?.biteText ?? caseItem.originalQuestion,
});

const createMockJobRunner = (state) => ({
  async classifyCase(draft) {
    return classifyByKeywords(draft.question);
  },
  async findSimilarCases(draft) {
    return scoreSimilarCases(draft, state);
  },
  async translateSource(payload) {
    return null;
  },
  async quickAssist(payload) {
    const prompt = String(payload.prompt ?? "").trim();
    if (!prompt) {
      return { text: "" };
    }

    return {
      text: `Mock Local AI is active. Quick AIssist received your prompt:\n\n${prompt}\n\nSwitch to a live provider for a real model response.`,
    };
  },
  async suggestStructure(payload) {
    return suggestStructureHeuristically(payload);
  },
  async assessConfidence(payload) {
    return assessConfidenceHeuristically(payload, state);
  },
  async suggestMetadata(payload) {
    return suggestMetadataHeuristically(payload);
  },
});

const buildJsonSchema = (name, properties, required) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

const pickFastTranslationModelId = (provider, currentModelId) => {
  const enabledModels = (provider?.modelOptions ?? []).filter((option) => option.enabled);
  if (!enabledModels.length) {
    return currentModelId;
  }

  if (String(currentModelId).toLowerCase().includes("flash")) {
    return currentModelId;
  }

  const stableFlashModel =
    enabledModels.find(
      (option) =>
        option.modelId?.toLowerCase().includes("flash") && !option.modelId?.toLowerCase().includes("preview"),
    ) ??
    enabledModels.find((option) => option.modelId?.toLowerCase().includes("flash"));

  return stableFlashModel?.modelId ?? currentModelId;
};

const createRemoteJobRunner = (adapter, modelId, state) => ({
  async classifyCase(draft) {
    const topicOptions = allowedTopics(state);
    const classification = await adapter.generateStructured({
      modelId,
      systemPrompt:
        `You classify Da'wah Desk cases. Return only structured JSON. Preserve the confidence-first, case-based workflow. Topic must be exactly one of: ${topicOptions.join(", ")}. Audience type must be one of: ${allowedAudienceTypes.join(", ")}. Question type must be one of: ${allowedQuestionTypes.join(", ")}. Difficulty must be one of: ${allowedDifficulty.join(", ")}. Likely intent must be one of: ${allowedLikelyIntent.join(", ")}. Prefer Allah / Tawhid for questions about who Allah is, the oneness of God, whether Muslims worship the same God, or the meaning of tawhid. Prefer Christianity / Jesus for questions specifically about Jesus, the Trinity, crucifixion, or Christian doctrine. Prefer Prophethood for questions specifically about Muhammad's prophethood or prophets in general. Use zzGeneral only when none of the topic labels clearly fit.`,
      userPrompt: `Question: ${draft.question}\nContext note: ${draft.contextNote ?? ""}`,
      schema: buildJsonSchema(
        "case_classification",
        {
          topic: { type: "string" },
          audienceType: { type: "string" },
          questionType: { type: "string" },
          difficulty: { type: "string" },
          likelyIntent: { type: "string" },
        },
        ["topic", "audienceType", "questionType", "difficulty", "likelyIntent"],
      ),
    });

    const normalizedQuestion = String(draft.question ?? "").toLowerCase();
    if (
      normalizedQuestion.includes("allah") ||
      normalizedQuestion.includes("tawhid") ||
      normalizedQuestion.includes("islam god") ||
      normalizedQuestion.includes("same god") ||
      normalizedQuestion.includes("one god")
    ) {
      classification.topic = "Allah / Tawhid";
    }

    return classification;
  },
  async findSimilarCases(draft) {
    // Similar-case retrieval is still primarily local; the model can assist later with reranking.
    return scoreSimilarCases(draft, state);
  },
  async translateSource(payload) {
    const source =
      state.sourceRecords.find((record) => record.sourceId === payload.sourceId) ??
      (payload.source
        ? {
            sourceId: payload.source.sourceId,
            title: payload.source.sourceTitle,
            text: payload.source.excerpt,
            excerpt: payload.source.excerpt,
          }
        : null);

    if (!source) return null;

    const targetLanguageLabel = payload.targetLanguageLabel || "English";
    const translatingToArabic = String(targetLanguageLabel).trim().toLowerCase() === "arabic";

    const result = await adapter.generateText({
      modelId,
      systemPrompt:
        "You assist with optional translation for Da'wah Desk. First detect the language of the original text from the text itself. Then compare it with the requested target language. If the target language is the same as the original language, treat the task as a rewording task and return a clearer, smoother rewrite in that same language while keeping the meaning faithful. Do not copy the text unchanged unless it is already extremely concise. If the target language is different, translate into the requested language. Return only the final rewritten or translated text. Do not add notes, labels, references, quotation marks, bullet points, or extra explanation. If the target language is Arabic, produce a clarified Arabic rewording rather than an English translation.",
      userPrompt: `Title: ${source.title}\nRequested target language: ${targetLanguageLabel}\nOriginal text:\n${source.excerpt ?? source.text ?? ""}`,
    });

    return {
      sourceId: source.sourceId,
      sourceTitle: source.title,
      sourceLinks: [source.sourceId],
      aiAssisted: true,
      originalText: source.excerpt ?? source.text ?? "",
      workingTranslation: result.text?.trim?.() ?? "",
      alternatives: [],
      targetLanguageLabel,
      targetLanguageCode: translatingToArabic ? "ar" : undefined,
    };
  },
  async quickAssist(payload) {
    const prompt = String(payload.prompt ?? "").trim();
    if (!prompt) {
      return { text: "" };
    }

    return adapter.generateText({
      modelId,
      systemPrompt:
        "You are Quick AIssist inside Da'wah Desk. Reply in plain helpful text for quick utility questions. Do not claim source traceability or fatwa authority. Keep answers concise unless the user clearly asks for depth.",
      userPrompt: prompt,
    });
  },
  async suggestStructure(payload) {
    return adapter.generateStructured({
      modelId,
      systemPrompt:
        "You suggest short, reusable response bites for Da'wah Desk. Return only structured JSON and preserve traceability-focused drafting. Always return 5 to 8 separate bite suggestions. Never combine multiple points into one suggestion. Include exactly one summary bite that briefly introduces or summarizes the detailed bites. Include at least one separate Quran-reference bite and one separate Sunnah-reference bite whenever relevant to the question. Write each guidance field as usable response text that speaks directly to the person asking the question. Do not write instructions to the app user, drafter, or responder. Write like a real human in a live chat, using simple, natural English that is easy for non-native speakers to understand across countries and cultures. Be clear, direct, warm, and conversational, but not overly enthusiastic. Do not sound like AI, marketing, or corporate support. Use plain wording, short to medium-length sentences, and straightforward explanations. Avoid long dashes, stock AI phrases, generic empathy lines, fancy vocabulary, slang, idioms, unnecessary bullet points, headings unless truly needed, and over-explaining. Prefer short natural openings, normal human phrasing, and concise replies unless more detail is clearly needed. Match the visitor's tone and level of formality while keeping the language internationally clear and easy to follow.",
        userPrompt: `Question: ${payload.question}\nTopic: ${payload.topic ?? ""}\nContext note: ${payload.contextNote ?? ""}\nEach suggestion must be one bite only. If you mention a source reference, put it in its own dedicated suggestion. One suggestion should be a concise summary bite and the others should expand it. The guidance text should read like something you could say directly to the questioner.`,
      schema: {
        type: "array",
        items: buildJsonSchema(
          "structure_suggestion",
          {
            biteTitle: { type: "string" },
            bitePurpose: { type: "string" },
            guidance: { type: "string" },
          },
          ["biteTitle", "bitePurpose", "guidance"],
        ),
      },
    });
  },
  async assessConfidence(payload) {
    // Confidence remains rule-based in V1 even when a remote model is selected.
    return assessConfidenceHeuristically(payload, state);
  },
  async suggestMetadata(payload) {
    return adapter.generateStructured({
      modelId,
      systemPrompt:
        "You suggest save metadata for Da'wah Desk. Return concise tags and summary fields in JSON only.",
      userPrompt: `Case title: ${payload.caseItem.title}\nOriginal question: ${payload.caseItem.originalQuestion}\nFirst bites:\n${(payload.bites ?? []).slice(0, 3).map((bite) => `- ${bite.biteTitle}: ${bite.biteText}`).join("\n")}`,
      schema: buildJsonSchema(
        "save_metadata",
        {
          suggestedTitle: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          audienceType: { type: "string" },
          questionType: { type: "string" },
          relatedThemes: { type: "array", items: { type: "string" } },
          duplicateWarning: { type: "string" },
          summarySnippet: { type: "string" },
        },
        ["suggestedTitle", "tags", "audienceType", "questionType", "relatedThemes", "summarySnippet"],
      ),
    });
  },
});

export const createAIService = (state, { sessionId = "local-session" } = {}) => {
  const { provider, model, sessionSelection } = resolveProviderModel(state, sessionId);
  const adapter = createAIProviderAdapter(provider);
  const runner =
    provider.providerType === "other"
      ? createMockJobRunner(state)
      : createRemoteJobRunner(adapter, model.modelId, state);

  return {
    provider,
    model,
    sessionSelection,
    async healthCheck() {
      return adapter.healthCheck({ modelId: model.modelId });
    },
    async classifyCase(payload) {
      return runner.classifyCase(payload);
    },
    async findSimilarCases(payload) {
      return runner.findSimilarCases(payload);
    },
    async translateSource(payload) {
      return runner.translateSource(payload);
    },
    async quickAssist(payload) {
      return runner.quickAssist(payload);
    },
    async suggestStructure(payload) {
      return runner.suggestStructure(payload);
    },
    async assessConfidence(payload) {
      return runner.assessConfidence(payload);
    },
    async suggestMetadata(payload) {
      return runner.suggestMetadata(payload);
    },
  };
};
