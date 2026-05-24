import { fetchQfChapterVerses, fetchQfVerseByKey, fetchQfVerseRange, searchQfVerses } from "./quranFoundation.js";
import { readCachedValue, writeCachedValue } from "./cache.js";

const classifyByKeywords = (question = "") => {
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
      audienceType: "Skeptic / Atheist",
      questionType: "Historical",
      difficulty: "Advanced",
      likelyIntent: "Critical inquiry",
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

export const classifyCase = async ({ question }) => classifyByKeywords(question);

const quranTopicReferences = {
  "Qur'an": ["15:9", "41:42", "85:21-22"],
  "Allah / Tawhid": ["112:1-4", "2:163", "5:73"],
  Sunnah: ["16:44", "59:7"],
  "Women and Family": ["4:124", "33:35"],
  Prophethood: ["33:40", "21:107"],
  "Jihad and Misconceptions": ["2:190-193", "22:39-40"],
  zzGeneral: ["16:125", "3:64"],
};

const cleanText = (value = "") => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const parseReferenceCandidates = (query = "") => {
  const matches = query.match(/\b\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g);
  return matches ? [...new Set(matches)] : [];
};

const parseChapterCandidate = (query = "") => {
  const trimmed = String(query).trim();
  const match = trimmed.match(/^(?:surah\s+)?(\d{1,3})$/i);
  return match ? Number(match[1]) : null;
};

const mapQuranRecordToSource = (record) => {
  const tafsir = Array.isArray(record.metadata?.tafsirs) ? record.metadata.tafsirs[0] : null;
  const translationText = cleanText(record.metadata?.translationText ?? "");
  const isApprovedFallback = record.retrievalMethod === "approved-web-fallback";
  const providerDomain = record.provider === "quran.com" ? "Quran.com" : undefined;
  return {
    sourceId: record.sourceId,
    sourceType: "quran",
    sourceTitle: record.title,
    sourceLanguage: "Arabic",
    excerpt: record.excerpt ?? record.text,
    fullReference: record.reference,
    trustLevel: "high",
    translationAvailable: Boolean(translationText),
    authenticatedTranslation: translationText || undefined,
    translationResourceId: record.metadata?.translationResourceId,
    translationResourceName: record.metadata?.translationResourceName,
    tafsirText: cleanText(tafsir?.text ?? "") || undefined,
    tafsirResourceId: tafsir?.resourceId,
    tafsirResourceName: tafsir?.resourceName,
    tafsirLanguageName: tafsir?.languageName,
    linkedBiteIds: [],
    sourceOrigin: "connector",
    connectorId: isApprovedFallback ? "conn-web-fallback" : "conn-quran-primary",
    connectorName: isApprovedFallback ? providerDomain : "Quran Foundation Adapter",
  };
};

const extractVerseKeyFromRecord = (record) => {
  if (typeof record?.metadata?.verseKey === "string") {
    return record.metadata.verseKey;
  }

  const referenceMatch = String(record?.reference ?? "").match(/(\d{1,3}:\d{1,3})/);
  if (referenceMatch) {
    return referenceMatch[1];
  }

  const sourceIdMatch = String(record?.sourceId ?? "").match(/(\d{1,3})-(\d{1,3})$/);
  if (sourceIdMatch) {
    return `${sourceIdMatch[1]}:${sourceIdMatch[2]}`;
  }

  return null;
};

const enrichFallbackQuranRecords = async (records, { translationResourceId, tafsirResourceId }) => {
  const settled = await Promise.allSettled(
    records.map(async (record) => {
      if (record?.sourceType !== "quran" || record?.retrievalMethod !== "approved-web-fallback") {
        return record;
      }

      const verseKey = extractVerseKeyFromRecord(record);
      if (!verseKey) {
        return record;
      }

      try {
        const hydrated = await fetchQfVerseByKey(verseKey, {
          translationResourceId,
          tafsirResourceId,
        });

        return {
          ...hydrated,
          sourceId: record.sourceId,
          title: record.title,
          reference: record.reference,
          provider: record.provider,
          retrievalMethod: record.retrievalMethod,
          metadata: {
            ...hydrated.metadata,
            domain: record.metadata?.domain ?? record.provider,
            url: record.metadata?.url,
          },
        };
      } catch {
        return record;
      }
    }),
  );

  return settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
};

const fetchTopicMappedQuranRecords = async (topic, limit, tafsirResourceId, translationResourceId) => {
  const references = quranTopicReferences[topic] ?? quranTopicReferences.zzGeneral;
  const records = [];

  for (const reference of references) {
    if (records.length >= limit) break;
    try {
      if (reference.includes("-")) {
        const rangeRecords = await fetchQfVerseRange(reference, { tafsirResourceId, translationResourceId });
        records.push(...rangeRecords);
      } else {
        records.push(await fetchQfVerseByKey(reference, { tafsirResourceId, translationResourceId }));
      }
    } catch {
      // Prelive has limited data. Skip missing references and continue.
    }
  }

  return records.slice(0, limit);
};

export const findSimilarCases = async ({ question, contextNote, personName, platform }, state) => {
  const classification = classifyByKeywords(question);
  const query = `${question} ${contextNote ?? ""} ${personName ?? ""} ${platform ?? ""}`.toLowerCase();

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
    .filter((match) => match.matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
};

export const searchSources = async ({ query = "", topic = "", category, limit = 6, includeTranslation = false, externalOnly = false, tafsirResourceId, translationResourceId }, state, registry) => {
  const cacheKey = JSON.stringify({
    cacheVersion: "2026-03-29-quran-translation-tafsir-v2",
    query,
    topic,
    category,
    limit,
    includeTranslation,
    externalOnly,
    tafsirResourceId,
    translationResourceId,
    allowWebFallback: state.settings?.general?.allowWebFallback,
    fallbackDomainAllowlist: state.settings?.general?.fallbackDomainAllowlist ?? [],
    connectors: {
      quran: registry.quran?.connector?.enabled,
      hadithEn: registry["hadith-en"]?.connector?.enabled,
      hadithAr: registry["hadith-ar"]?.connector?.enabled,
      other: registry.other?.connector?.enabled,
      web: registry.web?.connector?.enabled,
    },
  });
  const cached = readCachedValue("source-search", cacheKey, {
    enabled: state.settings?.general?.cachingEnabled,
  });
  if (cached) {
    return cached;
  }

  const quranConnectorEnabled = Boolean(registry.quran?.connector?.enabled);
  let quranPrimaryFailed = false;
  let quran = [];
  const requestedReferences = parseReferenceCandidates(query);
  const requestedChapter = parseChapterCandidate(query);

  if (quranConnectorEnabled && requestedReferences.length > 0) {
    try {
      const directRecords = [];
      for (const reference of requestedReferences) {
        if (directRecords.length >= limit) break;
        if (reference.includes("-")) {
          directRecords.push(...(await fetchQfVerseRange(reference, { tafsirResourceId, translationResourceId })));
        } else {
          directRecords.push(await fetchQfVerseByKey(reference, { tafsirResourceId, translationResourceId }));
        }
      }
      quran = directRecords.slice(0, limit);
    } catch {
      quranPrimaryFailed = true;
      quran = [];
    }
  } else if (quranConnectorEnabled && requestedChapter) {
    try {
      quran = (await fetchQfChapterVerses(requestedChapter, { includeTranslation, tafsirResourceId, translationResourceId })).slice(0, limit);
    } catch {
      quranPrimaryFailed = true;
      quran = [];
    }
  } else if (quranConnectorEnabled && query.trim()) {
    try {
      const searched = await searchQfVerses({ query, limit, tafsirResourceId, translationResourceId });
      if (searched.length > 0) {
        quran = searched;
      } else if (tafsirResourceId) {
        quran = [];
      } else {
        quran = await fetchTopicMappedQuranRecords(topic || classifyByKeywords(query).topic, limit, tafsirResourceId, translationResourceId);
      }
    } catch {
      quranPrimaryFailed = true;
      try {
        quran = tafsirResourceId
          ? []
          : await fetchTopicMappedQuranRecords(topic || classifyByKeywords(query).topic, limit, tafsirResourceId, translationResourceId);
      } catch {
        quran = [];
      }
    }
  } else if (quranConnectorEnabled && topic) {
    try {
      quran = await fetchTopicMappedQuranRecords(topic, limit, tafsirResourceId, translationResourceId);
    } catch {
      quranPrimaryFailed = true;
      quran = [];
    }
  }

  if (quranConnectorEnabled && quran.length === 0 && !tafsirResourceId) {
    try {
      quran = await registry.quran.search({ query, topic, limit, tafsirResourceId, translationResourceId }, state);
    } catch {
      quranPrimaryFailed = true;
      quran = [];
    }
  }

  const shouldIncludeQuran = !category || category === "quran";
  const shouldIncludeHadith = !category || category === "hadith";

  if (!shouldIncludeQuran) {
    quran = [];
  }

  const hadithEnglish = shouldIncludeHadith
    ? await registry["hadith-en"].search({ query, topic, limit }, state)
    : [];
  const hadithArabic = shouldIncludeHadith
    ? await registry["hadith-ar"].search({ query, topic, limit }, state)
    : [];
  const approvedOther = externalOnly ? [] : await registry.other.search({ query, topic, limit }, state);
  const fallback =
    !state.settings.general.allowWebFallback
      ? []
      : await registry.web.search({ query, topic, category, limit }, state);
  const enrichedFallback =
    shouldIncludeQuran && quranConnectorEnabled && !quranPrimaryFailed
      ? await enrichFallbackQuranRecords(fallback, { translationResourceId, tafsirResourceId })
      : fallback;

  const result = {
    quran,
    hadithEnglish,
    hadithArabic,
    approvedOther,
    fallback: enrichedFallback,
    flatRecommendations: [...quran, ...hadithArabic, ...hadithEnglish, ...approvedOther, ...enrichedFallback].map((source) => {
      const isQuran = source.sourceType === "quran";
      return {
        source: isQuran
          ? mapQuranRecordToSource(source)
          : {
              sourceId: source.sourceId,
              sourceType: source.sourceType,
              sourceTitle: source.title,
              sourceLanguage: source.language,
              excerpt: source.excerpt ?? source.text,
              fullReference: source.reference,
              trustLevel: source.trustTier === 1 ? "high" : source.trustTier === 2 ? "medium" : "needs-review",
              translationAvailable: Boolean(source.metadata?.translationText) || source.language === "Arabic",
              authenticatedTranslation: cleanText(source.metadata?.translationText ?? "") || undefined,
              translationResourceName: source.metadata?.translationResourceName,
              linkedBiteIds: [],
              sourceOrigin: "connector",
              connectorId: source.retrievalMethod === "approved-web-fallback" ? "conn-web-fallback" : source.sourceType === "hadith" ? "connector-hadith" : undefined,
              connectorName:
                source.retrievalMethod === "approved-web-fallback"
                  ? source.provider === "sunnah.com"
                    ? "Sunnah.com"
                    : source.provider === "quran.com"
                      ? "Quran.com"
                      : undefined
                  : source.sourceType === "hadith"
                    ? "Sunnah connector"
                    : undefined,
            },
        reason:
          isQuran && query.trim()
            ? "Quran connector retrieved case-relevant verses using the current query, topic, and reference heuristics."
            : source.trustTier === 1
              ? "Primary source surfaced by the backend connector registry."
              : "Approved source record surfaced by backend orchestration.",
      };
    }),
  };

  return writeCachedValue("source-search", cacheKey, result, {
    enabled: state.settings?.general?.cachingEnabled,
  });
};

export const translateSource = async ({ sourceId, source: providedSource }, state) => {
  const source =
    state.sourceRecords.find((record) => record.sourceId === sourceId) ??
    (providedSource
      ? {
          sourceId: providedSource.sourceId,
          sourceType: providedSource.sourceType,
          title: providedSource.sourceTitle,
          reference: providedSource.fullReference,
          language: providedSource.sourceLanguage,
          text: providedSource.excerpt,
          excerpt: providedSource.excerpt,
          trustTier:
            providedSource.sourceType === "quran" || providedSource.sourceType === "hadith"
              ? 1
              : providedSource.trustLevel === "medium"
                ? 2
                : 3,
        }
      : null);
  if (!source) return null;
  return null;
};

export const suggestStructure = async ({ question, selectedSources = [] }) => {
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

export const assessConfidence = async ({ bites = [], sourceCatalog = [] }, state) =>
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

export const suggestMetadata = async ({ caseItem, bites }) => ({
  suggestedTitle: caseItem.title,
  tags: [caseItem.topic, caseItem.audienceType, caseItem.questionType].filter(Boolean),
  audienceType: caseItem.audienceType,
  questionType: caseItem.questionType,
  relatedThemes: [caseItem.topic, caseItem.likelyIntent, caseItem.difficulty].filter(Boolean),
  duplicateWarning: caseItem.relatedCaseIds?.length ? "Similar saved material exists. Review duplicates before confirming save." : undefined,
  summarySnippet: bites?.[0]?.biteText ?? caseItem.originalQuestion,
});
