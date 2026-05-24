import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readCachedValue, writeCachedValue } from "./cache.js";
import { createFetchSignal } from "./utils.js";

const VERTEX_SA_PATH = path.join(os.homedir(), "DawahDeskData", "vertex-service-account.json");

// Fallback QF credentials — used when vertex-service-account.json does not contain qf_* fields.
// Existing installs without qf_* fields in their credential file continue to work unchanged.
const QF_FALLBACK_CLIENT_ID = "f58985e5-d7f9-4618-bc1f-21fafd520efb";
const QF_FALLBACK_CLIENT_SECRET = "S7xlgvgEbR-h8xk6KLha-0j8Af";
const QF_FALLBACK_ENV = "production";

const PRELIVE_CONFIG = {
  env: "prelive",
  authBaseUrl: "https://prelive-oauth2.quran.foundation",
  apiBaseUrl: "https://apis-prelive.quran.foundation",
};

const PRODUCTION_CONFIG = {
  env: "production",
  authBaseUrl: "https://oauth2.quran.foundation",
  apiBaseUrl: "https://apis.quran.foundation",
};

const QF_REQUEST_TIMEOUT_MS = 8_000;

const tokenCache = {
  token: null,
  expiresAtMs: 0,
  pendingPromise: null,
};

const mapFetchError = (error, label) => {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new Error(`${label} timed out after ${QF_REQUEST_TIMEOUT_MS}ms.`);
  }

  return error;
};

const cleanText = (value = "") => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const DEFAULT_TRANSLATION_RESOURCE_ID = 20;
const ARABIC_CHAR_PATTERN = /[\u0600-\u06FF]/;

const withVerseKeySuffix = (text = "", verseKey = "") => {
  const cleaned = cleanText(text);
  if (!cleaned || !verseKey) return cleaned;
  return cleaned.includes(`(${verseKey})`) ? cleaned : `${cleaned} (${verseKey})`;
};

const mapTafsirItems = (tafsirs = [], verseKey = "") =>
  (Array.isArray(tafsirs) ? tafsirs : [])
    .map((tafsir) => ({
      resourceId: tafsir.resource_id ?? tafsir.tafsir_id ?? tafsir.id,
      resourceName: tafsir.resource_name ?? tafsir.name,
      languageName: tafsir.language_name ?? tafsir.language_name_simple ?? tafsir.language?.name,
      text: withVerseKeySuffix(tafsir.text ?? "", verseKey),
    }))
    .filter((tafsir) => tafsir.resourceId && tafsir.text);

const buildVerseRecord = (verse, fallbackTitle = "Quran verse") => {
  const verseKey = verse.verse_key ?? fallbackTitle;
  const words = Array.isArray(verse.words) ? verse.words : [];
  const arabicText = words
    .map((word) => word.text_uthmani ?? word.text_qpc_hafs ?? word.text_indopak ?? "")
    .join(" ")
    .trim();
  const translationEntry = verse.translations?.[0];
  const translationText = withVerseKeySuffix(translationEntry?.text ?? "", verseKey);

  return {
    sourceId: `qf-verse-${String(verseKey).replace(":", "-")}`,
    sourceType: "quran",
    title: `Qur'an ${verseKey}`,
    reference: `Qur'an ${verseKey}`,
    language: "Arabic",
    text: arabicText || verse.text_uthmani || verse.text_imlaei || fallbackTitle,
    excerpt: arabicText || verse.text_uthmani || verse.text_imlaei || fallbackTitle,
    trustTier: 1,
    trustLabel: "primary",
    provider: "quran-foundation",
    retrievedAt: new Date().toISOString(),
    retrievalMethod: "api",
    metadata: {
      verseKey,
      translationText,
      translationResourceId: translationEntry?.resource_id ?? translationEntry?.id,
      translationResourceName: translationEntry?.resource_name ?? translationEntry?.name,
      chapterName: verse.chapter_name ?? verseKey,
      tafsirs: mapTafsirItems(verse.tafsirs, verseKey),
    },
  };
};

const parseVerseRef = (reference) => {
  const match = String(reference).match(/^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!match) return null;
  return {
    chapterNumber: Number(match[1]),
    startVerse: Number(match[2]),
    endVerse: match[3] ? Number(match[3]) : Number(match[2]),
  };
};

const parseChapterRef = (reference) => {
  const match = String(reference).trim().match(/^(?:(?:surah|chapter|سورة)\s+)?(\d{1,3})$/i);
  if (!match) return null;
  return Number(match[1]);
};

const parseExplicitChapterRef = (reference) => {
  const text = String(reference || "").trim();
  const numericMatch = text.match(/^(?:surah|chapter|سورة)\s+(\d{1,3})$/i);
  if (numericMatch) {
    return { chapterNumber: Number(numericMatch[1]), chapterName: null };
  }

  const nameMatch = text.match(/^(?:surah|chapter|سورة)\s+(.+)$/i);
  if (!nameMatch) {
    return null;
  }

  return {
    chapterNumber: null,
    chapterName: nameMatch[1]?.trim() || null,
  };
};

const normalizeChapterLookupKey = (value = "") => {
  const trimmed = String(value || "").trim();
  return ARABIC_CHAR_PATTERN.test(trimmed) ? normalizeArabicQuery(trimmed) : normalizeLatinQuery(trimmed);
};

const buildChapterLookupMap = (chapters = []) => {
  const lookup = new Map();

  const addAlias = (alias, chapterId) => {
    const key = normalizeChapterLookupKey(alias);
    if (key && !lookup.has(key)) {
      lookup.set(key, chapterId);
    }
  };

  for (const chapter of chapters) {
    const chapterId = Number(chapter.id ?? chapter.chapter_number ?? chapter.chapterNumber);
    if (!Number.isFinite(chapterId)) {
      continue;
    }

    addAlias(String(chapterId), chapterId);
    addAlias(`surah ${chapterId}`, chapterId);
    addAlias(`surat ${chapterId}`, chapterId);
    addAlias(chapter.name_simple, chapterId);
    addAlias(chapter.name_complex, chapterId);
    addAlias(chapter.name_arabic, chapterId);
    addAlias(chapter.name_simple_arabic, chapterId);
    addAlias(chapter.transliterated_name?.name, chapterId);
    addAlias(chapter.translated_name?.name, chapterId);
  }

  return lookup;
};

const resolveChapterByName = async (reference = "") => {
  const explicitReference = parseExplicitChapterRef(reference);
  const candidateName = explicitReference?.chapterName;
  if (!candidateName) {
    return null;
  }

  const lookupKey = normalizeChapterLookupKey(candidateName);
  if (!lookupKey) {
    return null;
  }

  const cachedLookup = readCachedValue("quran-chapters", "lookup");
  if (cachedLookup?.has?.(lookupKey)) {
    return cachedLookup.get(lookupKey) ?? null;
  }

  const data = await listQfChapters();
  const chapters = Array.isArray(data?.chapters) ? data.chapters : Array.isArray(data) ? data : [];
  const lookup = buildChapterLookupMap(chapters);
  writeCachedValue("quran-chapters", "lookup", lookup, { ttlMs: 12 * 60 * 60 * 1000 });
  return lookup.get(lookupKey) ?? null;
};

export const getQfConfig = () => {
  let vertexSa = {};
  try {
    vertexSa = JSON.parse(readFileSync(VERTEX_SA_PATH, "utf8"));
  } catch {
    // file not yet present or unreadable — use fallbacks
  }

  const clientId = vertexSa.qf_client_id || QF_FALLBACK_CLIENT_ID;
  const clientSecret = vertexSa.qf_client_secret || QF_FALLBACK_CLIENT_SECRET;
  const env = (vertexSa.qf_env || QF_FALLBACK_ENV) === "prelive" ? "prelive" : "production";
  const selected = env === "production" ? PRODUCTION_CONFIG : PRELIVE_CONFIG;

  return {
    env,
    clientId,
    clientSecret,
    authBaseUrl: selected.authBaseUrl,
    apiBaseUrl: selected.apiBaseUrl,
  };
};

const requestAccessToken = async () => {
  const config = getQfConfig();
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  let response;
  try {
    response = await fetch(`${config.authBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=content",
      signal: createFetchSignal(QF_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw mapFetchError(error, "Quran Foundation token request");
  }

  if (!response.ok) {
    throw new Error(`Quran Foundation token request failed: ${response.status}`);
  }

  const data = await response.json();
  tokenCache.token = data.access_token;
  tokenCache.expiresAtMs = Date.now() + Number(data.expires_in ?? 3600) * 1000;
  return tokenCache.token;
};

export const getQfAccessToken = async () => {
  const bufferMs = 30_000;
  if (tokenCache.token && Date.now() < tokenCache.expiresAtMs - bufferMs) {
    return tokenCache.token;
  }

  if (!tokenCache.pendingPromise) {
    tokenCache.pendingPromise = requestAccessToken().finally(() => {
      tokenCache.pendingPromise = null;
    });
  }

  return tokenCache.pendingPromise;
};

const qfFetch = async (pathname, { searchParams, retry = true } = {}) => {
  const config = getQfConfig();
  const url = new URL(pathname, config.apiBaseUrl);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const token = await getQfAccessToken();
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "x-auth-token": token,
        "x-client-id": config.clientId,
      },
      signal: createFetchSignal(QF_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw mapFetchError(error, "Quran Foundation request");
  }

  if (response.status === 401 && retry) {
    tokenCache.token = null;
    tokenCache.expiresAtMs = 0;
    return qfFetch(pathname, { searchParams, retry: false });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Quran Foundation request failed: ${response.status} ${body.slice(0, 160)}`);
  }

  return response.json();
};

const uniqueBySourceId = (records) => {
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.sourceId)) return false;
    seen.add(record.sourceId);
    return true;
  });
};

const normalizeArabicQuery = (value = "") =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLatinQuery = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildArabicQueryVariants = (query = "") => {
  const trimmed = String(query || "").trim();
  if (!trimmed || !ARABIC_CHAR_PATTERN.test(trimmed)) {
    return [trimmed].filter(Boolean);
  }

  const variants = new Set([trimmed, normalizeArabicQuery(trimmed)]);
  const terms = normalizeArabicQuery(trimmed).split(/\s+/).filter(Boolean);

  if (terms.length === 1) {
    const [term] = terms;
    if (term.startsWith("ال") && term.length > 2) {
      variants.add(term.slice(2));
    } else {
      variants.add(`ال${term}`);
    }
  }

  return [...variants].filter(Boolean);
};

const expandArabicQueryVariants = (query = "") => {
  const baseVariants = buildArabicQueryVariants(query);
  const expanded = new Set(baseVariants);

  for (const variant of baseVariants) {
    if (variant.includes("اسم")) {
      expanded.add(variant.replace(/اسم/g, "أسم"));
    }
    if (variant.includes("الاسم")) {
      expanded.add(variant.replace(/الاسم/g, "الأسم"));
    }
  }

  return [...expanded].filter(Boolean);
};

const buildArabicSearchCandidates = (query = "") => {
  const expanded = expandArabicQueryVariants(query);
  const candidates = new Set(expanded);

  for (const variant of expanded) {
    const normalized = normalizeArabicQuery(variant);
    if (!normalized) continue;

    if (normalized.startsWith("ال") && normalized.length > 4) {
      candidates.add(normalized.slice(2));
    }

    if (normalized.length >= 4) {
      candidates.add(normalized.slice(0, 3));
      candidates.add(normalized.slice(0, 4));
    }
  }

  return [...candidates].filter(Boolean);
};

const verseMatchesArabicVariants = (record, variants = []) => {
  const verseText = normalizeArabicQuery(record?.text ?? record?.excerpt ?? "");
  if (!verseText) {
    return false;
  }

  return variants.some((variant) => verseText.includes(normalizeArabicQuery(variant)));
};

const extractVerseKeys = (query = "") => {
  const matches = query.match(/\b(\d{1,3}:\d{1,3})\b/g);
  return matches ? [...new Set(matches)] : [];
};

const settledVerseFetches = async (verseKeys, options) => {
  const results = await Promise.allSettled(
    verseKeys.map((verseKey) => fetchQfVerseByKey(verseKey, options)),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
};

export const listQfChapters = async () => {
  const cached = readCachedValue("quran-chapters", "raw");
  if (cached) {
    return cached;
  }

  const data = await qfFetch("/content/api/v4/chapters");
  return writeCachedValue("quran-chapters", "raw", data, { ttlMs: 12 * 60 * 60 * 1000 });
};

export const listQfTafsirs = async () => {
  const data = await qfFetch("/content/api/v4/resources/tafsirs");
  const tafsirs = Array.isArray(data?.tafsirs) ? data.tafsirs : Array.isArray(data) ? data : [];
  return tafsirs.map((tafsir) => ({
    id: tafsir.id,
    name: tafsir.name,
    languageName: tafsir.language_name ?? tafsir.language_name_simple ?? tafsir.language?.name,
    authorName: tafsir.author_name ?? tafsir.author_name_simple,
    slug: tafsir.slug,
  }));
};

export const listQfTranslations = async () => {
  const data = await qfFetch("/content/api/v4/resources/translations");
  const translations = Array.isArray(data?.translations) ? data.translations : Array.isArray(data) ? data : [];
  return translations.map((translation) => ({
    id: translation.id,
    name: translation.name,
    languageName: translation.language_name ?? translation.language_name_simple ?? translation.language?.name,
    authorName: translation.author_name ?? translation.author_name_simple,
    slug: translation.slug,
  }));
};

export const fetchQfVerseByKey = async (verseKey, { tafsirResourceId, translationResourceId = DEFAULT_TRANSLATION_RESOURCE_ID } = {}) => {
  const data = await qfFetch(`/content/api/v4/verses/by_key/${verseKey}`, {
    searchParams: {
      words: true,
      word_fields: "text_uthmani,text_qpc_hafs",
      translations: translationResourceId,
      tafsirs: tafsirResourceId,
    },
  });
  const verse = data.verse ?? data;
  return buildVerseRecord(verse, verseKey);
};

export const fetchQfVerseRange = async (reference, { tafsirResourceId, translationResourceId = DEFAULT_TRANSLATION_RESOURCE_ID } = {}) => {
  const parsed = parseVerseRef(reference);
  if (!parsed) {
    return [];
  }

  const verseKeys = [];
  for (let verseNumber = parsed.startVerse; verseNumber <= parsed.endVerse; verseNumber += 1) {
    verseKeys.push(`${parsed.chapterNumber}:${verseNumber}`);
  }

  const records = await settledVerseFetches(verseKeys, { tafsirResourceId, translationResourceId });
  return records;
};

export const fetchQfChapterVerses = async (
  chapterNumber,
  { perPage = 50, includeTranslation = true, tafsirResourceId, translationResourceId = DEFAULT_TRANSLATION_RESOURCE_ID } = {},
) => {
  const allVerses = [];
  let page = 1;

  while (page <= 20) {
    const data = await qfFetch(`/content/api/v4/verses/by_chapter/${chapterNumber}`, {
      searchParams: {
        words: true,
        word_fields: "text_uthmani,text_qpc_hafs",
        page,
        per_page: perPage,
        translations: includeTranslation ? translationResourceId : undefined,
        tafsirs: tafsirResourceId,
      },
    });

    const verses = Array.isArray(data?.verses) ? data.verses : [];
    if (verses.length === 0) {
      break;
    }

    allVerses.push(...verses.map((verse) => buildVerseRecord(verse, `${chapterNumber}`)));

    const nextPage =
      data?.pagination?.next_page ??
      data?.meta?.next_page ??
      (verses.length < perPage ? null : page + 1);

    if (!nextPage || nextPage === page) {
      break;
    }

    page = Number(nextPage);
  }

  return uniqueBySourceId(allVerses);
};

export const searchQfVerses = async ({ query, limit = 100, tafsirResourceId, translationResourceId = DEFAULT_TRANSLATION_RESOURCE_ID }) => {
  const directRange = parseVerseRef(query);
  if (directRange && directRange.endVerse > directRange.startVerse) {
    return (await fetchQfVerseRange(query, { tafsirResourceId, translationResourceId })).slice(0, limit);
  }

  const directVerseKeys = extractVerseKeys(query);
  if (directVerseKeys.length > 0) {
    const directVerses = await settledVerseFetches(directVerseKeys.slice(0, limit), {
      tafsirResourceId,
      translationResourceId,
    });
    return uniqueBySourceId(directVerses);
  }

  const explicitChapter = parseExplicitChapterRef(query);
  const chapterNumber =
    explicitChapter?.chapterNumber ??
    parseChapterRef(query) ??
    (explicitChapter?.chapterName ? await resolveChapterByName(query) : null);
  if (chapterNumber) {
    return fetchQfChapterVerses(chapterNumber, { tafsirResourceId, translationResourceId });
  }

  const verseKeys = [];
  const isArabicQuery = ARABIC_CHAR_PATTERN.test(query);
  const queryVariants = isArabicQuery ? buildArabicSearchCandidates(query) : [String(query || "").trim()].filter(Boolean);

  for (const variant of queryVariants) {
    let page = 1;
    while (page <= 10 && verseKeys.length < limit) {
      const searchData = await qfFetch("/content/api/v4/search", {
        searchParams: {
          q: variant,
          size: 20,
          page,
          language: ARABIC_CHAR_PATTERN.test(variant) ? "ar" : "en",
        },
      });

      const nextKeys = (searchData?.search?.results ?? [])
        .map((result) => result.verse_key)
        .filter((value) => typeof value === "string");

      if (nextKeys.length === 0) {
        break;
      }

      verseKeys.push(...nextKeys);

      const nextPage =
        searchData?.search?.pagination?.next_page ??
        searchData?.pagination?.next_page ??
        (nextKeys.length < 20 ? null : page + 1);

      if (!nextPage || nextPage === page) {
        break;
      }

      page = Number(nextPage);
    }

    if (verseKeys.length >= limit) {
      break;
    }
  }

  const uniqueVerseKeys = [...new Set(verseKeys)].slice(0, limit);
  if (uniqueVerseKeys.length === 0) {
    return [];
  }

  const verses = await settledVerseFetches(uniqueVerseKeys, { tafsirResourceId, translationResourceId });
  const uniqueVerses = uniqueBySourceId(verses);

  if (!isArabicQuery) {
    return uniqueVerses;
  }

  const strictVariants = expandArabicQueryVariants(query);
  const filteredVerses = uniqueVerses.filter((record) => verseMatchesArabicVariants(record, strictVariants));
  return filteredVerses.slice(0, limit);
};
