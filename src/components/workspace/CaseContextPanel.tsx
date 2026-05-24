import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord } from "@/types";

type CaseContextPanelProps = {
  caseItem: CaseRecord;
  onCaseFieldChange?: (
    field:
      | "title"
      | "originalQuestion"
      | "contextNote"
      | "personName"
      | "platform"
      | "topic"
      | "audienceType"
      | "questionType"
      | "difficulty"
      | "likelyIntent",
    value: string,
  ) => void;
  onTagsChange?: (tags: string[]) => void;
  embedded?: boolean;
};

export const CaseContextPanel = ({
  caseItem,
  onCaseFieldChange,
  embedded = false,
}: CaseContextPanelProps) => (
  <section className={embedded ? "" : "panel px-5 py-5"}>
    <SectionTitle eyebrow="Case Context" title={caseItem.title} />
    <div className="space-y-4">
      <div className="rounded-2xl bg-stone-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Original question</p>
        <textarea
          rows={4}
          value={caseItem.originalQuestion}
          onChange={(event) => onCaseFieldChange?.("originalQuestion", event.target.value)}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Context</p>
          <textarea
            rows={4}
            value={caseItem.contextNote || ""}
            onChange={(event) => onCaseFieldChange?.("contextNote", event.target.value)}
            placeholder="Add context for this case"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
          />
        </div>
        <div className="rounded-2xl border border-stone-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Conversation details</p>
          <div className="mt-2 space-y-3 text-sm text-slate-700">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Person</span>
              <input
                value={caseItem.personName || ""}
                onChange={(event) => onCaseFieldChange?.("personName", event.target.value)}
                placeholder="Not captured"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platform</span>
              <input
                value={caseItem.platform || ""}
                onChange={(event) => onCaseFieldChange?.("platform", event.target.value)}
                placeholder="General"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <p>Status: {caseItem.status}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="default">{caseItem.topic}</Badge>
        <Badge tone="muted">{caseItem.audienceType}</Badge>
        <Badge tone="info">{caseItem.questionType}</Badge>
        <Badge tone="warning">{caseItem.difficulty}</Badge>
        <Badge tone="success">{caseItem.likelyIntent}</Badge>
      </div>
    </div>
  </section>
);
