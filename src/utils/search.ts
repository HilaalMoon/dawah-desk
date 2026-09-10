// Token-based search shared by the app's client-side filters.
//
// The previous behavior treated the whole query as one exact substring, so
// "mercy forgiveness" only matched text containing that literal phrase. Here
// the query is split into terms and each term must appear somewhere in the
// haystack (case-insensitive substring, any order) — the intuitive behavior
// for multi-word searches.
//
// Callers can pass a normalizer (e.g. Arabic diacritic stripping) applied to
// both the haystack and each term; the default just lowercases.
export const matchesSearchQuery = (
  haystack: string,
  query: string,
  normalize: (value: string) => string = (value) => value.toLowerCase(),
): boolean => {
  const terms = normalize(query)
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return true;
  const target = normalize(haystack);
  return terms.every((term) => target.includes(term));
};
