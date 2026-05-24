import { useState } from "react";
import { ArrowRight, BookMarked, Copy, Database, FolderOpenDot, Languages, MessageSquareQuote, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, SourceItem } from "@/types";

type HomeDashboardProps = {
  savedCases: CaseRecord[];
  activeCaseIds: string[];
  sourceItems: SourceItem[];
  onCreateCase: () => void;
  onOpenCase: (caseId: string) => void;
  onCopyText: (text: string, message?: string) => void;
};

export const HomeDashboard = ({
  savedCases,
  activeCaseIds,
  sourceItems,
  onCreateCase,
  onOpenCase,
  onCopyText,
}: HomeDashboardProps) => {
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(null);
  const recentCases = savedCases.filter((caseItem) => caseItem.status === "saved").slice(0, 4);
  const savedCount = savedCases.filter((caseItem) => caseItem.status === "saved").length;
  const topSources = [...sourceItems]
    .filter((source) => (source.accessCount ?? 0) > 0)
    .sort((a, b) => (b.accessCount ?? 0) - (a.accessCount ?? 0))
    .slice(0, 5);
  const topCases = [...savedCases]
    .filter((caseItem) => caseItem.status === "saved" && (caseItem.accessCount ?? 0) > 0)
    .sort((a, b) => (b.accessCount ?? 0) - (a.accessCount ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
        <section className="panel px-6 py-6">
          <SectionTitle title="Most Frequently Used Sources" description="Saved sources you use most often across cases." />

          <div className="space-y-4">
            {topSources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center">
                <p className="text-sm font-semibold text-slate-900">No source usage yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Sources you add into workspace cases will appear here once they are used.
                </p>
              </div>
            ) : (
              topSources.map((source) => (
                <button
                  key={source.sourceId}
                  type="button"
                  onClick={() => setSelectedSource(source)}
                  className="flex w-full items-start justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left hover:border-stone-300"
                >
                  <div className="pr-6">
                    <p className="text-sm font-semibold text-slate-900">{source.sourceTitle}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{source.excerpt}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="default">{source.sourceType}</Badge>
                      {source.topic ? <Badge tone="info">{source.topic}</Badge> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
                    <Database size={15} />
                    <span>{source.accessCount ?? 0}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel px-6 py-6">
            <SectionTitle
              title="Library Snapshot"
              action={
                <button
                  type="button"
                  onClick={onCreateCase}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  <Plus size={16} />
                  New Case
                </button>
              }
            />
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5">
              <div className="flex items-center gap-3">
                <FolderOpenDot size={20} className="text-olive" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{savedCount} saved cases available</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeCaseIds.length} open case tabs remain visible while saved cases stay reusable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => recentCases[0] && onOpenCase(recentCases[0].caseId)}
                disabled={!recentCases[0]}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                Open a saved case
                <ArrowRight size={16} />
              </button>
            </div>
          </section>

          <section className="panel px-6 py-6">
            <SectionTitle title="Most Frequently Used Cases" />
            <div className="space-y-3">
              {topCases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-900">No case usage yet</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Saved cases you open most often will appear here.
                  </p>
                </div>
              ) : (
                topCases.map((caseItem) => (
                  <button
                    key={caseItem.caseId}
                    type="button"
                    onClick={() => onOpenCase(caseItem.caseId)}
                    className="flex w-full items-start justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left hover:border-stone-300"
                  >
                    <div className="pr-4">
                      <p className="text-sm font-semibold text-slate-900">{caseItem.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{caseItem.originalQuestion}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
                      <BookMarked size={15} />
                      <span>{caseItem.accessCount ?? 0}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {selectedSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-stone-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Source Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedSource.sourceTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1.35fr,0.95fr]">
              <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Source Text</p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCopyText(selectedSource.excerpt, "Copied source text.")}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                      aria-label="Copy source text"
                    >
                      <Copy size={16} />
                    </button>
                    {selectedSource.authenticatedTranslation ? (
                      <button
                        type="button"
                        onClick={() => onCopyText(selectedSource.authenticatedTranslation ?? "", "Copied stored English translation.")}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                        aria-label="Copy English translation"
                      >
                        <Languages size={16} />
                      </button>
                    ) : null}
                    {selectedSource.tafsirText ? (
                      <button
                        type="button"
                        onClick={() => onCopyText(selectedSource.tafsirText ?? "", "Copied tafsir note.")}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                        aria-label="Copy tafsir note"
                      >
                        <MessageSquareQuote size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedSource.excerpt}</p>
                {selectedSource.authenticatedTranslation ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">Stored Translation</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selectedSource.authenticatedTranslation}
                    </p>
                  </div>
                ) : null}
                {selectedSource.tafsirText ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">
                      {selectedSource.tafsirResourceName ?? "Attached Tafsir"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedSource.tafsirText}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-semibold text-slate-900">Metadata</p>
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reference</p>
                    <p className="mt-1">{selectedSource.fullReference}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Type</p>
                    <p className="mt-1">{selectedSource.sourceType}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Topic</p>
                    <p className="mt-1">{selectedSource.topic || "No topic yet"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trust Level</p>
                    <p className="mt-1">{selectedSource.trustLevel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge tone="default">{selectedSource.sourceType}</Badge>
                    {selectedSource.topic ? <Badge tone="info">{selectedSource.topic}</Badge> : null}
                    {selectedSource.authenticatedTranslation ? <Badge tone="success">translation</Badge> : null}
                    {selectedSource.tafsirText ? <Badge tone="warning">tafsir</Badge> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
