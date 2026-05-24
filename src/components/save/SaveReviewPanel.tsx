import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SimilarCasesPanel } from "@/components/workspace/SimilarCasesPanel";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, ResponseBite, SaveMetadataSuggestion, SimilarCaseMatch } from "@/types";

type SaveReviewPanelProps = {
  caseItem: CaseRecord;
  bites: ResponseBite[];
  metadata: SaveMetadataSuggestion;
  matches: SimilarCaseMatch[];
  isLoadingSimilar: boolean;
  onBack: () => void;
  onMoveBite: (biteId: string, direction: "up" | "down") => void;
  onOpenCase: (caseId: string) => void;
  onReuseBite: (bite: ResponseBite) => void;
  onConfirm: () => void;
};

export const SaveReviewPanel = ({
  caseItem,
  bites,
  metadata,
  matches,
  isLoadingSimilar,
  onBack,
  onMoveBite,
  onOpenCase,
  onReuseBite,
  onConfirm,
}: SaveReviewPanelProps) => (
  <div className="space-y-6">
    <section className="panel px-6 py-6">
      <SectionTitle
        title="Save & Catalog Review"
        description="This save flow is a confirmation pass over AI-prepared metadata, not a long manual form."
        action={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested title</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{metadata.suggestedTitle}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Summary snippet</p>
            <p className="mt-2 text-sm text-slate-700">{metadata.summarySnippet}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {metadata.tags.map((tag) => (
                <Badge key={tag} tone="info">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Related themes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {metadata.relatedThemes.map((theme) => (
                <Badge key={theme} tone="default">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
          {metadata.duplicateWarning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {metadata.duplicateWarning}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Case</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{caseItem.title}</p>
            <p className="mt-2 text-sm text-slate-700">{caseItem.originalQuestion}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Response bites preview</p>
            {bites.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No bites added yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Go back to the workspace to add or draft response bites before saving this case.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {bites.map((bite, index) => (
                <div key={bite.biteId} className="rounded-xl bg-stone-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{bite.biteTitle}</p>
                      <p className="mt-1 text-sm text-slate-700">{bite.biteText}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onMoveBite(bite.biteId, "up")}
                        disabled={index === 0}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700 disabled:opacity-40"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveBite(bite.biteId, "down")}
                        disabled={index === bites.length - 1}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700 disabled:opacity-40"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <SimilarCasesPanel
          matches={matches}
          isLoading={isLoadingSimilar}
          onOpenCase={onOpenCase}
          onReuseBite={onReuseBite}
          readOnly
        />
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onConfirm} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
          Confirm Save
        </button>
      </div>
    </section>
  </div>
);
