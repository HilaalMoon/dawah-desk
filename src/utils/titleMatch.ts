export type MatchLevel = "exact" | "close" | "none";

export const MATCH_ORDER: Record<MatchLevel, number> = { exact: 0, close: 1, none: 2 };

export const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const titleMatchLevel = (a: string, b: string): MatchLevel => {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);

  if (na.length < 3) return "none";

  const trigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3));
    return set;
  };

  const ta = trigrams(na);
  const tb = trigrams(nb);

  if (ta.size === 0 || tb.size === 0) return "none";

  const shared = [...ta].filter((t) => tb.has(t)).length;
  const score = shared / Math.max(ta.size, tb.size);

  if (score >= 0.85) return "exact";
  if (score >= 0.35) return "close";
  return "none";
};
