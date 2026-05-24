import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, SaveMetadataSuggestion } from "@/types";

type CatalogingPanelProps = {
  caseItem: CaseRecord;
  metadata?: SaveMetadataSuggestion;
  topicOptions?: string[];
  audienceTypeOptions?: string[];
  questionTypeOptions?: string[];
  difficultyOptions?: string[];
  likelyIntentOptions?: string[];
  onCaseFieldChange?: (
    field:
      | "title"
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

export const CatalogingPanel = ({
  caseItem,
  metadata,
  topicOptions = [],
  audienceTypeOptions = [],
  questionTypeOptions = [],
  difficultyOptions = [],
  likelyIntentOptions = [],
  onCaseFieldChange,
  onTagsChange,
  embedded = false,
}: CatalogingPanelProps) => (
  <section className={embedded ? "" : "panel px-5 py-5"}>
    <SectionTitle
      eyebrow="Cataloging"
      title="Library metadata"
      description="Refine how this case will be classified and found later before you save it."
    />
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Case title</span>
          <input
            value={caseItem.title}
            onChange={(event) => onCaseFieldChange?.("title", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Topic</span>
          <select
            value={topicOptions.includes(caseItem.topic) ? caseItem.topic : ""}
            onChange={(event) => onCaseFieldChange?.("topic", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="">Select topic</option>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Audience type</span>
          <select
            value={audienceTypeOptions.includes(caseItem.audienceType) ? caseItem.audienceType : ""}
            onChange={(event) => onCaseFieldChange?.("audienceType", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="">Select audience type</option>
            {audienceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question type</span>
          <select
            value={questionTypeOptions.includes(caseItem.questionType) ? caseItem.questionType : ""}
            onChange={(event) => onCaseFieldChange?.("questionType", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="">Select question type</option>
            {questionTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Difficulty</span>
          <select
            value={difficultyOptions.includes(caseItem.difficulty) ? caseItem.difficulty : ""}
            onChange={(event) => onCaseFieldChange?.("difficulty", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="">Select difficulty</option>
            {difficultyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Likely intent</span>
          <select
            value={likelyIntentOptions.includes(caseItem.likelyIntent) ? caseItem.likelyIntent : ""}
            onChange={(event) => onCaseFieldChange?.("likelyIntent", event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="">Select likely intent</option>
            {likelyIntentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</span>
        <input
          value={(metadata?.tags ?? []).join(", ")}
          onChange={(event) =>
            onTagsChange?.(
              event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            )
          }
          placeholder="qira'at, preservation, interfaith"
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
        />
      </label>
    </div>
  </section>
);
