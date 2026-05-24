import { searchQfVerses, listQfChapters, fetchQfVerseByKey } from "./quranFoundation.js";
import { withTimeout } from "./utils.js";
import { listApprovedFallbackDomains, searchApprovedDomainFallback } from "./webFallback.js";

const quranHealthCache = {
  result: null,
  expiresAtMs: 0,
};
const QURAN_HEALTH_TTL_MS = 60_000;
const QURAN_HEALTH_TIMEOUT_MS = 6_000;

const scoreTerms = (haystack, terms) =>
  terms.reduce((total, term) => {
    if (!term) return total;
    return haystack.includes(term) ? total + 1 : total;
  }, 0);

const normalizeQueryTerms = (query = "", topic = "") =>
  `${query} ${topic}`
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

const createAdapter = (connector, predicate) => ({
  connector,
  async search({ query, topic, limit = 6 }, state) {
    if (!connector?.enabled) {
      return [];
    }
    const terms = normalizeQueryTerms(query, topic);
    return state.sourceRecords
      .filter(predicate)
      .map((record) => {
        const haystack = `${record.title} ${record.reference} ${record.text} ${record.excerpt ?? ""}`.toLowerCase();
        return { record, score: terms.length === 0 ? 1 : scoreTerms(haystack, terms) };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.record);
  },
  async getById(id, state) {
    return state.sourceRecords.find((record) => record.sourceId === id && predicate(record)) ?? null;
  },
  async healthCheck() {
    return { ok: true, message: connector.enabled ? "Connector enabled" : "Connector disabled" };
  },
});

const createQuranFoundationAdapter = (connector) => ({
  connector,
  async search({ query, topic, limit = 6, tafsirResourceId, translationResourceId }, state) {
    if (!connector?.enabled) return [];

    const remoteQuery = `${query ?? ""} ${topic ?? ""}`.trim();
    if (!remoteQuery) {
      return [];
    }

    try {
      return await searchQfVerses({
        query: remoteQuery,
        limit,
        tafsirResourceId,
        translationResourceId,
      });
    } catch {
      return [];
    }
  },
  async getById(id, state) {
    const knownRecord = state.sourceRecords.find((record) => record.sourceId === id && record.sourceType === "quran");
    if (knownRecord) {
      return knownRecord;
    }

    const verseKey = id.startsWith("qf-verse-") ? id.replace("qf-verse-", "").replace("-", ":") : null;
    if (!verseKey) {
      return null;
    }

    try {
      return await fetchQfVerseByKey(verseKey);
    } catch {
      return null;
    }
  },
  async healthCheck() {
    if (!connector?.enabled) {
      return { ok: false, message: "Connector disabled" };
    }

    if (quranHealthCache.result && Date.now() < quranHealthCache.expiresAtMs) {
      return quranHealthCache.result;
    }

    try {
      const data = await withTimeout(
        () => listQfChapters(),
        QURAN_HEALTH_TIMEOUT_MS,
        "Quran Foundation health check",
      );
      const total = Array.isArray(data?.chapters) ? data.chapters.length : 0;
      const result = {
        ok: true,
        message: total > 0 ? `Connected · ${total} chapters reachable` : "Connected",
      };
      quranHealthCache.result = result;
      quranHealthCache.expiresAtMs = Date.now() + QURAN_HEALTH_TTL_MS;
      return result;
    } catch (error) {
      const result = {
        ok: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
      quranHealthCache.result = result;
      quranHealthCache.expiresAtMs = Date.now() + QURAN_HEALTH_TTL_MS;
      return result;
    }
  },
});

const createApprovedWebFallbackAdapter = (connector, state) => ({
  connector,
  async search({ query, topic, category, limit = 6 }, currentState) {
    if (!connector?.enabled) {
      return [];
    }

    const allowlist = currentState.settings?.general?.fallbackDomainAllowlist ?? [];
    return searchApprovedDomainFallback({
      query: `${query ?? ""} ${topic ?? ""}`.trim(),
      category,
      limit,
      timeoutMs: currentState.settings?.general?.sourceTimeoutMs,
      allowlist,
    });
  },
  async getById() {
    return null;
  },
  async healthCheck() {
    if (!connector?.enabled) {
      return { ok: false, message: "Connector disabled" };
    }

    const allowlist = state.settings?.general?.fallbackDomainAllowlist ?? [];
    const activeDomains = listApprovedFallbackDomains(allowlist);
    return {
      ok: activeDomains.length > 0,
      message:
        activeDomains.length > 0
          ? `Approved fallback ready for ${activeDomains.join(" and ")}`
          : "No approved fallback domains are currently allowed",
    };
  },
});

export const createConnectorRegistry = (state) => {
  const enabledConnectors = state.connectors.filter((connector) => connector.enabled);
  const byCategory = Object.fromEntries(enabledConnectors.map((connector) => [connector.category, connector]));

  return {
    quran: createQuranFoundationAdapter(byCategory.quran ?? { enabled: false, name: "Quran Foundation Adapter" }),
    "hadith-en": createAdapter(
      byCategory["hadith-en"] ?? { enabled: false, name: "Sunnah English Adapter" },
      (record) => record.sourceType === "hadith" && record.language === "English",
    ),
    "hadith-ar": createAdapter(
      byCategory["hadith-ar"] ?? { enabled: false, name: "Sunnah Arabic Adapter" },
      (record) => record.sourceType === "hadith" && record.language === "Arabic",
    ),
    other: createAdapter(
      byCategory.other ?? { enabled: false, name: "Approved Sources Adapter" },
      (record) => record.trustTier === 2,
    ),
    web: createApprovedWebFallbackAdapter(
      byCategory.web ?? { enabled: false, name: "Controlled Web Fallback" },
      state,
    ),
  };
};
