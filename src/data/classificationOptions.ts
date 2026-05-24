export const audienceTypeOptions = [
  "General",
  "Seeker",
  "Christian / Jesus-focused",
  "Jewish",
  "Non-Muslim / Interfaith",
  "Skeptic / Atheist",
  "Critical / Challenging",
  "Muslim / Doubting",
] as const;

export const questionTypeOptions = [
  "Clarification",
  "Comparative",
  "Evidential",
  "Textual",
  "Theological",
  "Historical",
  "Ethical / Social",
  "Challenging / Critical",
] as const;

export const difficultyOptions = [
  "Easy",
  "Medium",
  "Advanced",
  "Hard",
] as const;

export const likelyIntentOptions = [
  "Seek understanding",
  "Seeking proof",
  "Seeking conviction",
  "General curiosity",
  "Clarification",
  "Challenge",
  "Critical inquiry",
  "Personal guidance",
  "Needs review",
] as const;

export const topicOptions = [
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
] as const;

const normalize = (value = "") => value.trim().toLowerCase();
const topicStopWords = new Set(["and", "or", "the", "of", "in", "on", "for", "about", "to", "a", "an"]);

const getTopicTokens = (value = "") =>
  normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !topicStopWords.has(token));

const synonymMap: Record<string, string> = {
  "mixed audience": "General",
  "general audience": "General",
  inquirer: "Seeker",
  "sincere curiosity": "General curiosity",
  "genuine exploration": "Seek understanding",
  "sincere skepticism": "Critical inquiry",
  "skeptical / secular": "Skeptic / Atheist",
  "critical / mixed": "Critical / Challenging",
  "critical / media-influenced": "Critical / Challenging",
  "christian / interfaith": "Christian / Jesus-focused",
  "christian / jew": "Non-Muslim / Interfaith",
  "seeker/non-muslim": "Non-Muslim / Interfaith",
  "non-muslim / skeptic": "Skeptic / Atheist",
  "theological + textual": "Textual",
  "historical + methodological": "Historical",
  "ethical + social": "Ethical / Social",
  "ethical + legal": "Ethical / Social",
  "medium-high": "Advanced",
  "medium high": "Advanced",
  "high": "Hard",
  "challenging but reachable": "Challenge",
  "hostile simplification": "Challenge",
  "needs human review": "Needs review",
  "seeking conviction/confirmation of truth": "Seeking conviction",
};

export const constrainToOptions = (value: string, options: readonly string[], fallback = "") => {
  const normalized = normalize(value);
  const canonical = synonymMap[normalized] ?? value;
  const exact = options.find((option) => normalize(option) === normalize(canonical));
  return exact ?? fallback;
};

const topicSynonymMap: Record<string, string> = {
  tawhid: "Allah / Tawhid",
  trinity: "Allah / Tawhid",
  allah: "Allah / Tawhid",
  quran: "Qur'an",
  "qur'an preservation": "Qur'an",
  hadith: "Sunnah",
  sunnah: "Sunnah",
  aqidah: "Aqidah / Belief",
  belief: "Aqidah / Belief",
  worship: "Worship and Practice",
  practice: "Worship and Practice",
  christianity: "Christianity / Jesus",
  jesus: "Christianity / Jesus",
  science: "Science and Reason",
  reason: "Science and Reason",
  women: "Women and Family",
  family: "Women and Family",
  jihad: "Jihad and Misconceptions",
  misconception: "Jihad and Misconceptions",
  afterlife: "Afterlife and Salvation",
  salvation: "Afterlife and Salvation",
  doubts: "Personal Doubts / Guidance",
  doubt: "Personal Doubts / Guidance",
  guidance: "Personal Doubts / Guidance",
  prophethood: "Prophethood",
  prophet: "Prophethood",
};

export const constrainTopicToAllowedOptions = (topic: string, options: readonly string[]) => {
  const normalized = normalize(topic);
  const exact = options.find((option) => normalize(option) === normalized);
  if (exact) return exact;

  const synonym = topicSynonymMap[normalized];
  if (synonym) {
    const synonymMatch = options.find((option) => normalize(option) === normalize(synonym));
    if (synonymMatch) return synonymMatch;
  }

  for (const [keyword, mappedTopic] of Object.entries(topicSynonymMap)) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      const mappedMatch = options.find((option) => normalize(option) === normalize(mappedTopic));
      if (mappedMatch) return mappedMatch;
    }
  }

  const keywordMatch = options.find((option) => {
    const optionWords = normalize(option).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return optionWords.some((word) => normalized.includes(word) || word.includes(normalized));
  });
  if (keywordMatch) return keywordMatch;

  const topicTokens = getTopicTokens(topic);
  let bestMatch = "";
  let bestScore = 0;

  for (const option of options) {
    const optionTokens = getTopicTokens(option);
    const overlap = optionTokens.filter((token) =>
      topicTokens.some((topicToken) => topicToken.includes(token) || token.includes(topicToken)),
    ).length;

    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = option;
    }
  }

  if (bestScore > 0) {
    return bestMatch;
  }

  const generalFallback = options.find((option) => normalize(option) === "zzgeneral");
  return generalFallback ?? "";
};
