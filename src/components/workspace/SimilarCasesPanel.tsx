import { ArrowRight, ChevronDown, ChevronUp, CopyPlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, ResponseBite, SimilarCaseMatch } from "@/types";
import { useAppStore } from "@/state/useAppStore";
import { MATCH_ORDER, MatchLevel, titleMatchLevel } from "@/utils/titleMatch";

const EMPTY_BITES_BY_CASE: Record<string, ResponseBite[]> = {};

type SimilarCasesPanelProps = {
  matches: SimilarCaseMatch[];
  searchableCases?: CaseRecord[];
  searchableBitesByCase?: Record<string, ResponseBite[]>;
  isLoading: boolean;
  onOpenCase: (caseId: string) => void;
  onReuseBite: (bite: ResponseBite) => void;
  embedded?: boolean;
  readOnly?: boolean;
  allowOpenCaseWhenReadOnly?: boolean;
  draftTitle?: string;
};

export const SimilarCasesPanel = ({
  matches,
  searchableCases = [],
  searchableBitesByCase = EMPTY_BITES_BY_CASE,
  isLoading,
  onOpenCase,
  onReuseBite,
  embedded = false,
  readOnly = false,
  allowOpenCaseWhenReadOnly = false,
  draftTitle,
}: SimilarCasesPanelProps) => {
  const [expandedCaseIds, setExpandedCaseIds] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState("");
  const allSavedCases = useAppStore((s) => s.savedCases);
  // scoredCaseIds: the set of caseIds that came from the AI similarity scorer.
  // Defined first so sortedMatches and manualSearchMatches can both use it.
  const scoredCaseIds = useMemo(
    () => new Set(matches.map((m) => m.caseItem.caseId)),
    [matches],
  );
  const sortedMatches = useMemo(() => {
    if (!draftTitle) {
      return [...matches].sort((l, r) =>
        l.caseItem.title.localeCompare(r.caseItem.title, undefined, { sensitivity: "base" }),
      );
    }

    // Same pattern as ImportCasesModal: scan full library, keep exact/close, carry level.
    const titleOnlyEntries: SimilarCaseMatch[] = allSavedCases
      .map((c) => ({ c, level: titleMatchLevel(draftTitle, c.title) }))
      .filter(({ level, c }) => level !== "none" && !scoredCaseIds.has(c.caseId))
      .map(({ c }) => ({
        caseItem: c,
        matchScore: 0,
        reasons: [] as string[],
        matchingBites: [...(searchableBitesByCase[c.caseId] ?? [])].sort(
          (a, b) => a.biteOrder - b.biteOrder,
        ),
      }));

    // Combine title-only additions with scored matches, then sort by title match level.
    return [...titleOnlyEntries, ...matches].sort((left, right) => {
      const levelLeft = MATCH_ORDER[titleMatchLevel(draftTitle, left.caseItem.title)];
      const levelRight = MATCH_ORDER[titleMatchLevel(draftTitle, right.caseItem.title)];
      if (levelLeft !== levelRight) return levelLeft - levelRight;
      return left.caseItem.title.localeCompare(right.caseItem.title, undefined, { sensitivity: "base" });
    });
  }, [matches, draftTitle, allSavedCases, searchableBitesByCase, scoredCaseIds]);
  const manualSearchMatches = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    if (!query) return [];

    return searchableCases
      .filter((caseItem) => !scoredCaseIds.has(caseItem.caseId))
      .filter((caseItem) => {
        const haystack = `${caseItem.title} ${caseItem.originalQuestion}`.toLowerCase();
        return haystack.includes(query);
      })
      .map((caseItem) => ({
        caseItem,
        matchScore: 0,
        reasons: ["manual search match"],
        matchingBites: [...(searchableBitesByCase[caseItem.caseId] ?? [])].sort(
          (left, right) => left.biteOrder - right.biteOrder,
        ),
      }))
      .sort((left, right) =>
        left.caseItem.title.localeCompare(right.caseItem.title, undefined, { sensitivity: "base" }),
      )
      .slice(0, 12);
  }, [manualSearch, scoredCaseIds, searchableBitesByCase, searchableCases]);
  const displayedMatches = useMemo(() => {
    const combined = [...sortedMatches, ...manualSearchMatches];
    const seen = new Set<string>();
    return combined.filter((match) => {
      if (seen.has(match.caseItem.caseId)) return false;
      seen.add(match.caseItem.caseId);
      return true;
    });
  }, [manualSearchMatches, sortedMatches]);

  const toggleExpanded = (caseId: string) => {
    setExpandedCaseIds((current) =>
      current.includes(caseId) ? current.filter((id) => id !== caseId) : [...current, caseId],
    );
  };

  const listClassName =
    embedded || readOnly ? "max-h-[52rem] space-y-4 overflow-y-auto pr-1" : "space-y-4";

  return (
    <section className={embedded ? "" : "panel px-5 py-5"}>
      <SectionTitle
        eyebrow="Library-first"
        title="Similar Cases Check"
        description="This step appears before deep source search so the da'ee can reuse prior work first."
      />
      <label className="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          value={manualSearch}
          onChange={(event) => setManualSearch(event.target.value)}
          className="w-full border-none bg-transparent text-sm outline-none"
          placeholder="Search saved cases for reuse"
        />
      </label>
      {isLoading ? <p className="text-sm text-slate-500">Checking saved cases and bites...</p> : null}
      {!isLoading && displayedMatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-slate-900">No similar saved cases found</p>
          <p className="mt-2 text-sm text-slate-600">
            Continue with source search and drafting, or search the saved library directly for reusable cases.
          </p>
        </div>
      ) : null}
      <div className={listClassName}>
        {displayedMatches.map((match) => {
          const isExpanded = expandedCaseIds.includes(match.caseItem.caseId);
          const displayedBites = isExpanded ? match.matchingBites : [];

          return (
            <div key={match.caseItem.caseId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => toggleExpanded(match.caseItem.caseId)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={isExpanded ? "Collapse case match details" : "Expand case match details"}
                >
                  <p className="text-sm font-semibold text-slate-900">{match.caseItem.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{match.caseItem.originalQuestion}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(() => {
                      const titleLevel: MatchLevel = draftTitle
                        ? titleMatchLevel(draftTitle, match.caseItem.title)
                        : "none";
                      // Show score badges for scored matches and manual search results.
                      // Title-only additions have reasons: [] and are not in scoredCaseIds.
                      const showScoreBadges =
                        scoredCaseIds.has(match.caseItem.caseId) || match.reasons.length > 0;
                      return (
                        <>
                          {showScoreBadges ? (
                            <>
                              {match.reasons.map((reason) => (
                                <Badge key={reason} tone="info">
                                  {reason}
                                </Badge>
                              ))}
                              <Badge tone="success">{match.matchScore}% match</Badge>
                              <Badge tone="muted">{match.matchingBites.length} bites</Badge>
                            </>
                          ) : null}
                          {titleLevel === "exact" ? (
                            <span className="shrink-0 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                              Exact duplicate
                            </span>
                          ) : titleLevel === "close" ? (
                            <span className="shrink-0 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Possible duplicate
                            </span>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </button>
                <div className="flex shrink-0 items-start gap-2">
                  {!readOnly || allowOpenCaseWhenReadOnly ? (
                    <button
                      type="button"
                      onClick={() => onOpenCase(match.caseItem.caseId)}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    >
                      Open Case
                      <ArrowRight size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(match.caseItem.caseId)}
                    className="rounded-xl border border-stone-200 bg-white p-2 text-slate-700"
                    aria-label={isExpanded ? "Collapse case match details" : "Expand case match details"}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {displayedBites.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {displayedBites.map((bite) => (
                    <div key={bite.biteId} className="rounded-2xl border border-white bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{bite.biteTitle}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{bite.biteText}</p>
                        </div>
                        {readOnly ? null : (
                          <button
                            type="button"
                            onClick={() => onReuseBite(bite)}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                          >
                            <CopyPlus size={16} />
                            Reuse Bite
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
