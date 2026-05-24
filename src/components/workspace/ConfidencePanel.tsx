import { AlertTriangle, CheckCircle2, Link2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ResponseBite } from "@/types";

type ConfidencePanelProps = {
  bites: ResponseBite[];
  onAssess: () => void;
  onSelectBite: (biteId: string) => void;
};

const supportTone = (status: ResponseBite["supportStatus"]) => {
  switch (status) {
    case "direct-source":
      return "success";
    case "translated-source":
      return "info";
    case "ai-assisted":
      return "default";
    case "weak-support":
    case "missing-support":
      return "warning";
    default:
      return "muted";
  }
};

const priorityScore: Record<ResponseBite["supportStatus"], number> = {
  "missing-support": 0,
  "weak-support": 1,
  "ai-assisted": 2,
  "translated-source": 3,
  "direct-source": 4,
};

export const ConfidencePanel = ({ bites, onAssess, onSelectBite }: ConfidencePanelProps) => {
  const direct = bites.filter((bite) => bite.supportStatus === "direct-source").length;
  const translated = bites.filter((bite) => bite.translationUsed).length;
  const aiAssisted = bites.filter((bite) => bite.aiAssisted).length;
  const needsReview = bites.filter(
    (bite) => bite.supportStatus === "weak-support" || bite.supportStatus === "missing-support",
  ).length;
  const prioritizedBites = [...bites].sort(
    (a, b) => priorityScore[a.supportStatus] - priorityScore[b.supportStatus] || a.biteOrder - b.biteOrder,
  );

  return (
    <section
      tabIndex={0}
      className="panel flex h-full min-h-0 flex-col px-5 py-5 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)]"
    >
      <div className="-mx-5 sticky top-0 z-10 bg-white/95 px-5 pb-4 backdrop-blur">
        <SectionTitle
          eyebrow="Confidence / Support"
          title="Traceability view"
          description="Each bite carries a visible support state so the human reviewer can quickly spot where trust is strongest and where review is still needed. Review support refreshes only non-manual statuses."
          action={
            <button
              type="button"
              onClick={onAssess}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Review Support
            </button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={18} />
              <p className="text-sm font-semibold">Direct sources</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-emerald-800">{direct}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sky-700">
              <Link2 size={18} />
              <p className="text-sm font-semibold">Translated support</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-sky-800">{translated}</p>
          </div>
          <div className="rounded-2xl bg-stone-100 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck size={18} />
              <p className="text-sm font-semibold">AI-assisted bites</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-slate-800">{aiAssisted}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={18} />
              <p className="text-sm font-semibold">Needs review</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-amber-800">{needsReview}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {prioritizedBites.map((bite) => (
          <button
            key={bite.biteId}
            type="button"
            onClick={() => onSelectBite(bite.biteId)}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left hover:border-stone-300"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-6 text-slate-900">{bite.biteTitle}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {bite.translationUsed ? <Badge tone="info">translated support</Badge> : null}
                {bite.aiAssisted ? <Badge tone="default">AI-assisted</Badge> : null}
                <Badge tone={supportTone(bite.supportStatus)}>{bite.supportStatus}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                {bite.structuredSourceLayout === "split-source" ? bite.sourcePrimaryText ?? bite.biteText : bite.biteText}
              </p>
              <p className="mt-2 text-xs text-slate-500">{bite.sourceLinks.length} source link(s)</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
