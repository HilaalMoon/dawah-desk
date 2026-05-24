import { createFetchSignal, isAllowedDomain } from "./utils.js";

const stripHtml = (value = "") =>
  String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

const parseVerseReference = (query = "") => {
  const match = String(query || "").trim().match(/^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!match) return null;
  return {
    chapterNumber: Number(match[1]),
    startVerse: Number(match[2]),
    endVerse: match[3] ? Number(match[3]) : Number(match[2]),
  };
};

const parseChapterReference = (query = "") => {
  const match = String(query || "").trim().match(/^(?:(?:surah|chapter|سورة)\s+)?(\d{1,3})$/i);
  return match ? Number(match[1]) : null;
};

const buildQuranComExcerpt = (verse = {}) => {
  const words = Array.isArray(verse.words) ? verse.words : [];
  const joinedWords = words
    .map((word) => word.text_uthmani ?? word.text_qpc_hafs ?? word.text_indopak ?? "")
    .join(" ")
    .trim();
  return stripHtml(joinedWords || verse.text_uthmani || verse.text_imlaei || "");
};

const mapQuranComVerseRecord = (verse) => {
  const verseKey = verse?.verse_key ?? "unknown";
  const excerpt = buildQuranComExcerpt(verse);
  return createRecord({
    sourceId: `quran-com-${String(verseKey).replace(":", "-")}`,
    sourceType: "quran",
    title: `Qur'an ${verseKey}`,
    reference: `Qur'an ${verseKey}`,
    excerpt,
    language: "Arabic",
    trustTier: 1,
    provider: "quran.com",
    url: `https://quran.com/${String(verseKey).replace(":", "/")}`,
  });
};

const createRecord = ({
  sourceId,
  sourceType,
  title,
  reference,
  excerpt,
  language,
  trustTier,
  provider,
  url,
  metadata = {},
}) => ({
  sourceId,
  sourceType,
  title,
  reference,
  text: excerpt,
  excerpt,
  language,
  trustTier,
  trustLabel: trustTier === 1 ? "primary" : trustTier === 2 ? "approved" : "needs-review",
  provider,
  retrievedAt: new Date().toISOString(),
  retrievalMethod: "approved-web-fallback",
  metadata: {
    domain: provider,
    url,
    ...metadata,
  },
});

const quranComAdapter = {
  domain: "quran.com",
  label: "Quran.com",
  async search({ query, limit, timeoutMs }) {
    const directVerseReference = parseVerseReference(query);
    if (directVerseReference) {
      const verseKeys = [];
      for (let verseNumber = directVerseReference.startVerse; verseNumber <= directVerseReference.endVerse; verseNumber += 1) {
        verseKeys.push(`${directVerseReference.chapterNumber}:${verseNumber}`);
      }

      const settled = await Promise.allSettled(
        verseKeys.slice(0, limit).map(async (verseKey) => {
          const response = await fetch(`https://api.quran.com/api/v4/verses/by_key/${verseKey}?words=true&word_fields=text_uthmani,text_qpc_hafs`, {
            headers: {
              Accept: "application/json",
            },
            signal: createFetchSignal(timeoutMs),
          });

          if (!response.ok) {
            throw new Error(`Quran.com by-key fallback failed: ${response.status}`);
          }

          const data = await response.json();
          return mapQuranComVerseRecord(data?.verse ?? {});
        }),
      );

      return settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
    }

    const directChapterReference = parseChapterReference(query);
    if (directChapterReference) {
      const response = await fetch(
        `https://api.quran.com/api/v4/verses/by_chapter/${directChapterReference}?words=true&word_fields=text_uthmani,text_qpc_hafs&page=1&per_page=${Math.min(limit, 20)}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: createFetchSignal(timeoutMs),
        },
      );

      if (!response.ok) {
        throw new Error(`Quran.com by-chapter fallback failed: ${response.status}`);
      }

      const data = await response.json();
      const verses = Array.isArray(data?.verses) ? data.verses : [];
      return verses.slice(0, limit).map((verse) => mapQuranComVerseRecord(verse));
    }

    const url = new URL("https://api.quran.com/api/v4/search");
    url.searchParams.set("q", query);
    url.searchParams.set("size", String(Math.min(limit, 20)));
    url.searchParams.set("page", "1");
    url.searchParams.set("language", "en");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: createFetchSignal(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Quran.com fallback search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = Array.isArray(data?.search?.results) ? data.search.results : [];

    return results.slice(0, limit).map((result) =>
      createRecord({
        sourceId: `quran-com-${String(result.verse_key).replace(":", "-")}`,
        sourceType: "quran",
        title: `Qur'an ${result.verse_key}`,
        reference: `Qur'an ${result.verse_key}`,
        excerpt: stripHtml(result.text ?? result.highlighted ?? ""),
        language: "Arabic",
        trustTier: 1,
        provider: "quran.com",
        url: `https://quran.com/${String(result.verse_key).replace(":", "/")}`,
      }),
    );
  },
};

const findClassBlock = (html, classNames) => {
  const classPatterns = classNames.map((className) => className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tagRegex = new RegExp(
    `<([a-z0-9]+)\\b[^>]*class=(["'])[^"']*(?:${classPatterns.join("|")})[^"']*\\2[^>]*>`,
    "i",
  );
  const match = tagRegex.exec(html);
  if (!match) {
    return "";
  }

  const tagName = match[1];
  const startTagIndex = match.index;
  const startTagEnd = html.indexOf(">", startTagIndex);
  if (startTagEnd === -1) {
    return "";
  }

  const tokenRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tokenRegex.lastIndex = startTagIndex;
  let depth = 0;
  let firstOpeningSeen = false;
  let closingTagStart = -1;
  let token;

  while ((token = tokenRegex.exec(html))) {
    const raw = token[0];
    const isClosing = raw.startsWith("</");
    if (!isClosing) {
      depth += 1;
      firstOpeningSeen = true;
    } else if (firstOpeningSeen) {
      depth -= 1;
      if (depth === 0) {
        closingTagStart = token.index;
        break;
      }
    }
  }

  if (closingTagStart === -1) {
    return "";
  }

  return html.slice(startTagEnd + 1, closingTagStart);
};

const fetchHtml = async (url, timeoutMs) => {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
    },
    signal: createFetchSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Fallback request failed: ${response.status}`);
  }

  return response.text();
};

const extractSunnahPage = (html, href) => {
  const titleBlock =
    stripHtml(findClassBlock(html, ["englishchapter", "book_page_english_name"])) ||
    stripHtml(findClassBlock(html, ["book_title"])) ||
    stripHtml((html.match(/<title>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "");

  const englishText =
    stripHtml(findClassBlock(html, ["text_details", "english_hadith_full", "englishcontainer"])) ||
    stripHtml(findClassBlock(html, ["actualHadithContainer"])) ||
    "";

  const arabicText =
    stripHtml(findClassBlock(html, ["arabic_hadith_full", "arabic_text_details", "arabiccontainer"])) ||
    stripHtml(findClassBlock(html, ["arabic"])) ||
    "";

  const cleanedEnglish = englishText.replace(/^(?:[A-Za-z]+\s+[\w'-]+\s+\d+\s*)/, "").trim();

  return {
    title: titleBlock || `Sunnah ${href}`,
    englishText: cleanedEnglish,
    arabicText,
  };
};

const parseSunnahSearchResultLinks = (html, limit) => {
  const results = [];
  const seen = new Set();
  const anchorPattern = /<a[^>]+href="\/([^"]+:\d+[^"]*)"[^>]*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) && results.length < limit) {
    const href = match[1];
    if (seen.has(href)) {
      continue;
    }
    seen.add(href);
    results.push(href);
  }

  return results;
};

const sunnahAdapter = {
  domain: "sunnah.com",
  label: "Sunnah.com",
  async search({ query, limit, timeoutMs }) {
    const directReference = String(query).trim().match(/^[a-z]+:\d+$/i)?.[0];
    let hrefs = [];

    if (directReference) {
      hrefs = [directReference.toLowerCase()];
    } else {
      const url = new URL("https://sunnah.com/search");
      url.searchParams.set("q", query);
      const html = await fetchHtml(url, timeoutMs);
      hrefs = parseSunnahSearchResultLinks(html, limit);
    }

    const settled = await Promise.allSettled(
      hrefs.slice(0, limit).map(async (href) => {
        const pageHtml = await fetchHtml(`https://sunnah.com/${href}`, timeoutMs);
        const page = extractSunnahPage(pageHtml, href);
        const excerpt = page.arabicText || page.englishText;

        if (!excerpt) {
          return null;
        }

        return createRecord({
          sourceId: `sunnah-com-${href.replace(/[^a-z0-9:-]+/gi, "-")}`,
          sourceType: "hadith",
          title: page.title,
          reference: href,
          excerpt,
          language: page.arabicText ? "Arabic" : "English",
          trustTier: 1,
          provider: "sunnah.com",
          url: `https://sunnah.com/${href}`,
          metadata: {
            translationText: page.arabicText ? page.englishText : undefined,
            translationResourceName: page.arabicText ? "Sunnah.com English translation" : undefined,
          },
        });
      }),
    );

    return settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
  },
};

const domainAdapters = [quranComAdapter, sunnahAdapter];

export const searchApprovedDomainFallback = async ({
  query,
  category,
  limit = 6,
  timeoutMs,
  allowlist = [],
}) => {
  if (!query?.trim()) {
    return [];
  }

  const adapters = domainAdapters.filter((adapter) => {
    if (!isAllowedDomain(adapter.domain, allowlist)) {
      return false;
    }

    if (category === "quran") {
      return adapter.domain === "quran.com";
    }

    if (category === "hadith") {
      return adapter.domain === "sunnah.com";
    }

    return true;
  });

  if (adapters.length === 0) {
    return [];
  }

  const perAdapterLimit = Math.max(1, Math.ceil(limit / adapters.length));
  const settled = await Promise.allSettled(
    adapters.map((adapter) =>
      adapter.search({
        query,
        limit: perAdapterLimit,
        timeoutMs,
      }),
    ),
  );

  return settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .slice(0, limit);
};

export const listApprovedFallbackDomains = (allowlist = []) =>
  domainAdapters
    .filter((adapter) => isAllowedDomain(adapter.domain, allowlist))
    .map((adapter) => adapter.label);
