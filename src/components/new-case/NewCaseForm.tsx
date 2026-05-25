import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SimilarCasesPanel } from "@/components/workspace/SimilarCasesPanel";
import { CaseClassification, CaseDraftInput, SimilarCaseMatch } from "@/types";

type NewCaseFormProps = {
  draft: CaseDraftInput;
  classification: CaseClassification;
  topicOptions: string[];
  audienceTypeOptions: string[];
  questionTypeOptions: string[];
  difficultyOptions: string[];
  likelyIntentOptions: string[];
  isClassifying: boolean;
  classificationError?: string | null;
  onDraftChange: (field: keyof CaseDraftInput, value: string) => void;
  onClassificationChange: (field: keyof CaseClassification, value: string) => void;
  onRunClassification: () => void;
  onOpenWorkspace: () => void;
  similarMatches: SimilarCaseMatch[];
  isLoadingSimilar: boolean;
  onOpenSimilarCase: (caseId: string) => void;
};

const fields: Array<{ key: keyof CaseClassification; label: string }> = [
  { key: "topic", label: "Topic" },
  { key: "audienceType", label: "Audience Type" },
  { key: "questionType", label: "Question Type" },
  { key: "difficulty", label: "Difficulty" },
  { key: "likelyIntent", label: "Likely Intent" },
];

export const NewCaseForm = ({
  draft,
  classification,
  topicOptions,
  audienceTypeOptions,
  questionTypeOptions,
  difficultyOptions,
  likelyIntentOptions,
  isClassifying,
  classificationError,
  onDraftChange,
  onClassificationChange,
  onRunClassification,
  onOpenWorkspace,
  similarMatches,
  isLoadingSimilar,
  onOpenSimilarCase,
}: NewCaseFormProps) => (
  <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-[1.2fr,0.9fr]">
      <section className="panel px-6 py-6">
        <SectionTitle
          title="New Case Setup"
          description="Turn an incoming question into a structured case with editable AI-assisted classification."
        />

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Incoming question</span>
            <textarea
              rows={7}
              value={draft.question}
              onChange={(event) => onDraftChange("question", event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm outline-none transition focus:border-slate-400"
              placeholder="Paste the incoming da'wah or interfaith question here..."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Case name</span>
              <input
                value={draft.caseName}
                onChange={(event) => onDraftChange("caseName", event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="AI can suggest this, but you can rename it"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Person name (optional)</span>
              <input
                value={draft.personName}
                onChange={(event) => onDraftChange("personName", event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Name, handle, or identifier"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Platform (optional)</span>
              <input
                value={draft.platform}
                onChange={(event) => onDraftChange("platform", event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="YouTube, DM, comments, forum..."
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Context note (optional)</span>
            <textarea
              rows={4}
              value={draft.contextNote}
              onChange={(event) => onDraftChange("contextNote", event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm outline-none transition focus:border-slate-400"
              placeholder="Tone, urgency, or conversation context"
            />
          </label>
        </div>
      </section>

      <section className="panel px-6 py-6">
        <SectionTitle
          title="Editable classification"
          description="AI proposes structure, and the da'ee remains in control of the trust-sensitive fields."
          action={
            <button
              type="button"
              onClick={onRunClassification}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <Sparkles size={16} />
              {isClassifying ? "Classifying..." : "Suggest classification"}
            </button>
          }
        />

        {classificationError ? (
          <p className="mb-4 text-sm text-red-600">{classificationError}</p>
        ) : null}

        <div className="space-y-4">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">{field.label}</span>
              {field.key === "topic" ? (
                <select
                  value={topicOptions.includes(classification.topic) ? classification.topic : ""}
                  onChange={(event) => onClassificationChange(field.key, event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select topic</option>
                  {topicOptions.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={classification[field.key] === "Awaiting classification" || classification[field.key] === "Needs review" ? "" : classification[field.key]}
                  onChange={(event) => onClassificationChange(field.key, event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {(field.key === "audienceType"
                    ? audienceTypeOptions
                    : field.key === "questionType"
                      ? questionTypeOptions
                      : field.key === "difficulty"
                        ? difficultyOptions
                        : likelyIntentOptions
                  ).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-mist px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Why this step matters</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="info">Reusable case memory</Badge>
            <Badge tone="success">Similar-case retrieval</Badge>
            <Badge tone="warning">Human validation preserved</Badge>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-4 text-sm font-semibold text-white"
        >
          Open Workspace
        </button>
      </section>
    </div>

    {classification.topic !== "Awaiting classification" || isLoadingSimilar ? (
      <section className="panel px-6 py-6">
        <SimilarCasesPanel
          matches={similarMatches}
          isLoading={isLoadingSimilar}
          onOpenCase={onOpenSimilarCase}
          onReuseBite={() => undefined}
          embedded
          readOnly
          allowOpenCaseWhenReadOnly
          draftTitle={draft.caseName}
        />
      </section>
    ) : null}
  </div>
);
