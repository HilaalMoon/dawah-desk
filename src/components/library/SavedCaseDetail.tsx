import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, ResponseBite, SourceItem } from "@/types";

type SavedCaseDetailProps = {
  caseItem: CaseRecord;
  bites: ResponseBite[];
  sources: SourceItem[];
  onReuseSequence: () => void;
  onOpenWorkspace: () => void;
};

export const SavedCaseDetail = ({
  caseItem,
  bites,
  sources,
  onReuseSequence,
  onOpenWorkspace,
}: SavedCaseDetailProps) => (
  <div className="space-y-6">
    <section className="panel px-6 py-6">
      <SectionTitle
        title="Saved Case Detail"
        description="Open a saved case, inspect the bite sequence, and reuse selected content into active work."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={onOpenWorkspace} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-slate-900">
              Open In Workspace
            </button>
            <button
              type="button"
              onClick={onReuseSequence}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              Reuse Full Sequence
            </button>
          </div>
        }
      />
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
        <p className="text-sm font-semibold text-slate-900">{caseItem.title}</p>
        <p className="mt-2 text-sm text-slate-700">{caseItem.originalQuestion}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="info">{caseItem.topic}</Badge>
          <Badge tone="muted">{caseItem.questionType}</Badge>
          <Badge tone="default">{caseItem.audienceType}</Badge>
        </div>
      </div>
      <div className="grid gap-4">
        {bites.map((bite) => (
          <div key={bite.biteId} className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">{bite.biteTitle}</p>
            <p className="mt-2 text-sm text-slate-700">{bite.biteText}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">{bite.supportStatus}</Badge>
              {sources
                .filter((source) => bite.sourceLinks.includes(source.sourceId))
                .map((source) => (
                  <Badge key={source.sourceId} tone="muted">
                    {source.sourceTitle}
                  </Badge>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);
