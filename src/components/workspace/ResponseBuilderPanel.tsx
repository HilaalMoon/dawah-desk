import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Languages,
  MessageSquareQuote,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { BitePurpose, CaseRecord, ResponseBite, StructureSuggestion, SupportStatus } from "@/types";
import { downloadCsv } from "@/utils/csv";
import { classNames } from "@/utils/format";

type ResponseBuilderPanelProps = {
  caseItem: CaseRecord;
  bites: ResponseBite[];
  structureSuggestions: StructureSuggestion[];
  isGeneratingStructure: boolean;
  onAddBite: () => void;
  onGenerateStructure: () => void;
  onClearSuggestions: () => void;
  onMoveBite: (biteId: string, direction: "up" | "down") => void;
  onUpdateBite: (biteId: string, changes: Partial<ResponseBite>) => void;
  onRemoveBite: (biteId: string) => void;
  onAcceptSuggestion: (index: number) => void;
  onCopyBite: (bite: ResponseBite) => void;
  onTranslateBite: (bite: ResponseBite) => void;
  onCopyBiteTafsir: (bite: ResponseBite) => void;
};

const bitePurposeOptions: BitePurpose[] = [
  "opening",
  "key-claim",
  "evidence",
  "clarification",
  "objection-response",
  "invitation",
  "summary",
];

const supportStatusOptions: SupportStatus[] = [
  "direct-source",
  "translated-source",
  "ai-assisted",
  "weak-support",
  "missing-support",
];

const sourceCategoryOptions: Array<NonNullable<ResponseBite["sourceCategory"]>> = ["quran", "hadith", "user", "other"];

const sourceCategoryLabels: Record<NonNullable<ResponseBite["sourceCategory"]>, string> = {
  quran: "Quran",
  hadith: "Sunnah",
  user: "User",
  other: "Other",
};

const buildExpandedNotes = (notes = "", expanded: boolean) => {
  const cleaned = notes.replace("[details-expanded]", "").trim();
  return expanded ? `${cleaned ? `${cleaned} ` : ""}[details-expanded]`.trim() : cleaned;
};

const getSupportTone = (status: SupportStatus) =>
  status === "missing-support" || status === "weak-support" ? "warning" : "success";

const previewClass = "text-sm leading-6 text-slate-700";

const getSourceCategory = (bite: ResponseBite): NonNullable<ResponseBite["sourceCategory"]> => {
  if (bite.sourceCategory) return bite.sourceCategory;
  if (bite.structuredSourceLayout === "split-source") return "quran";
  if (bite.sourceLinks.length === 0) return "user";
  return "other";
};

export const ResponseBuilderPanel = ({
  caseItem,
  bites,
  structureSuggestions,
  isGeneratingStructure,
  onAddBite,
  onGenerateStructure,
  onClearSuggestions,
  onMoveBite,
  onUpdateBite,
  onRemoveBite,
  onAcceptSuggestion,
  onCopyBite,
  onTranslateBite,
  onCopyBiteTafsir,
}: ResponseBuilderPanelProps) => {
  const [editingBite, setEditingBite] = useState<ResponseBite | null>(null);
  const [expandedBiteId, setExpandedBiteId] = useState<string | null>(null);

  const toggleExpanded = (biteId: string) => {
    setExpandedBiteId((current) => (current === biteId ? null : biteId));
  };

  const exportBitesCsv = () => {
    downloadCsv(
      `${caseItem.title.replace(/[^\w.-]+/g, "_") || "workspace-bites"}-bites.csv`,
      bites.map((bite) => ({
        caseTitle: caseItem.title,
        caseQuestion: caseItem.originalQuestion,
        caseTopic: caseItem.topic,
        caseAudienceType: caseItem.audienceType,
        caseQuestionType: caseItem.questionType,
        caseDifficulty: caseItem.difficulty,
        caseLikelyIntent: caseItem.likelyIntent,
        biteOrder: bite.biteOrder,
        biteTitle: bite.biteTitle,
        bitePurpose: bite.bitePurpose,
        biteText: bite.biteText,
        sourceCategory: bite.sourceCategory ?? "",
        supportStatus: bite.supportStatus,
        supportStatusManuallySet: bite.supportStatusManuallySet ?? false,
        aiAssisted: bite.aiAssisted,
        translationUsed: bite.translationUsed,
        usedInConversation: bite.usedInConversation ?? false,
        sourcePrimaryText: bite.sourcePrimaryText ?? "",
        sourceSecondaryText: bite.sourceSecondaryText ?? "",
        sourceSecondaryLabel: bite.sourceSecondaryLabel ?? "",
        translationResourceName: bite.translationResourceName ?? "",
        sourceTafsirText: bite.sourceTafsirText ?? "",
        sourceTafsirLabel: bite.sourceTafsirLabel ?? "",
        tafsirResourceName: bite.tafsirResourceName ?? "",
        notes: bite.notes ?? "",
      })),
    );
  };

  return (
    <>
      <section
        tabIndex={0}
        className="panel flex h-full min-h-0 flex-col px-5 py-5 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)]"
      >
        <div className="-mx-5 sticky top-0 z-10 bg-white/95 px-5 pb-4 backdrop-blur">
          <SectionTitle
            eyebrow="Response Builder"
            title="Draft in short logical bites"
            description="The response builder favors reusable bite-sized drafting instead of a single opaque answer box."
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportBitesCsv}
                  disabled={bites.length === 0}
                  className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Extract bites"
                  title="Extract"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={onGenerateStructure}
                  disabled={isGeneratingStructure || structureSuggestions.length > 0 || bites.length > 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  {isGeneratingStructure ? "Generating..." : "Suggest Structure"}
                </button>
                <button
                  type="button"
                  onClick={onAddBite}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  <Plus size={16} />
                  Add Bite
                </button>
              </div>
            }
          />
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {structureSuggestions.length > 0 ? (
            <div className="rounded-2xl bg-mist px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Suggested structure</p>
                  <p className="mt-1 text-sm text-slate-600">
                    These are AI suggestions for this case only. Add the ones you want into the editable bite list below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearSuggestions}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-rose-600"
                  aria-label="Dismiss remaining structure suggestions"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 grid gap-3">
                {structureSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.biteTitle}-${suggestion.bitePurpose}-${index}`}
                    className="rounded-xl bg-white px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="info">{suggestion.bitePurpose}</Badge>
                        <p className="text-sm font-semibold text-slate-900">{suggestion.biteTitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAcceptSuggestion(index)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                      >
                        Add to bites
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{suggestion.guidance}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {bites.map((bite, index) => {
            const isSplitSource = bite.structuredSourceLayout === "split-source" && Boolean(bite.sourcePrimaryText);
            const hasExpandableDetails = true;
            const isExpanded = expandedBiteId === bite.biteId;

            return (
              <div
                key={bite.biteId}
                id={`builder-bite-${bite.biteId}`}
                className={classNames(
                  "rounded-2xl border px-4 py-4",
                  bite.usedInConversation ? "border-stone-300 bg-stone-200" : "border-stone-200 bg-stone-50",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(bite.biteId)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={isExpanded ? "Collapse bite details" : "Expand bite details"}
                  >
                    <div className="flex flex-wrap items-start gap-2 pr-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{bite.biteTitle}</p>
                      <Badge tone="muted">{bite.bitePurpose}</Badge>
                      <Badge tone={getSupportTone(bite.supportStatus)}>{bite.supportStatus}</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="info">{bite.sourceLinks.length} linked source(s)</Badge>
                      {bite.translationUsed ? <Badge tone="info">translated support</Badge> : null}
                      {bite.aiAssisted ? <Badge tone="default">AI-assisted draft</Badge> : null}
                    </div>

                    {isSplitSource ? (
                      <div className="mt-3 space-y-3">
                        <div className={classNames("rounded-2xl border border-stone-200 bg-white px-4", isExpanded ? "py-4" : "py-3")}>
                          {isExpanded ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Arabic</p>
                          ) : null}
                          <p className={classNames("text-sm leading-7 text-slate-800", isExpanded ? "mt-3" : "line-clamp-2")}>
                            {bite.sourcePrimaryText}
                          </p>
                        </div>
                        {isExpanded && bite.sourceSecondaryText ? (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                              {bite.sourceSecondaryLabel ?? bite.translationResourceName ?? "English translation"}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-slate-800">{bite.sourceSecondaryText}</p>
                          </div>
                        ) : null}
                        {isExpanded && bite.sourceTafsirText ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                              {bite.sourceTafsirLabel ?? bite.tafsirResourceName ?? "Tafsir"}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-slate-800">{bite.sourceTafsirText}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <p className={classNames(previewClass, !isExpanded && "line-clamp-2")}>{bite.biteText}</p>
                      </div>
                    )}
                  </button>

                  <div className="flex shrink-0 flex-col gap-2">
                    <label className="flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(bite.usedInConversation)}
                        onChange={(event) => onUpdateBite(bite.biteId, { usedInConversation: event.target.checked })}
                        aria-label="Mark bite as used in the active conversation"
                        className="h-4 w-4 rounded border-stone-300 text-slate-900 focus:ring-slate-300"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(bite.biteId)}
                      className="rounded-xl border border-stone-200 bg-white p-2 text-slate-700"
                      aria-label={isExpanded ? "Collapse bite details" : "Expand bite details"}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isExpanded ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingBite({ ...bite })}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                          aria-label="Edit bite"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyBite(bite)}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTranslateBite(bite)}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                        >
                          <Languages size={16} />
                        </button>
                        {bite.sourceTafsirText ? (
                          <button
                            type="button"
                            onClick={() => onCopyBiteTafsir(bite)}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                          >
                            <MessageSquareQuote size={16} />
                          </button>
                        ) : null}
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
                        <button
                          type="button"
                          onClick={() => onRemoveBite(bite.biteId)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {editingBite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-6 py-10">
          <div className="flex h-[min(720px,88vh)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Edit Bite</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{editingBite.biteTitle || "Untitled bite"}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Review and update this bite for the current case, then save the changes back into the workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBite(null)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
                <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
                  <p className="text-sm font-semibold text-slate-900">Metadata</p>
                  <div className="mt-4 space-y-4">
                    <SettingField label="Bite title">
                      <input
                        value={editingBite.biteTitle}
                        onChange={(event) => setEditingBite((current) => (current ? { ...current, biteTitle: event.target.value } : current))}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </SettingField>

                    <SettingField label="Bite purpose">
                      <select
                        value={editingBite.bitePurpose}
                        onChange={(event) =>
                          setEditingBite((current) =>
                            current ? { ...current, bitePurpose: event.target.value as BitePurpose } : current,
                          )
                        }
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        {bitePurposeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </SettingField>

                    <SettingField label="Support status">
                      <select
                        value={editingBite.supportStatus}
                        onChange={(event) =>
                          setEditingBite((current) =>
                            current
                              ? {
                                  ...current,
                                  supportStatus: event.target.value as SupportStatus,
                                  supportStatusManuallySet: true,
                                }
                              : current,
                          )
                        }
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        {supportStatusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </SettingField>

                    <SettingField label="Source">
                      <select
                        value={getSourceCategory(editingBite)}
                        onChange={(event) =>
                          setEditingBite((current) =>
                            current
                              ? {
                                  ...current,
                                  sourceCategory: event.target.value as NonNullable<ResponseBite["sourceCategory"]>,
                                }
                              : current,
                          )
                        }
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        {sourceCategoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </SettingField>
                  </div>
                </section>

                <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
                  <p className="text-sm font-semibold text-slate-900">Content</p>
                  <div className="mt-4 space-y-4">
                    {editingBite.structuredSourceLayout === "split-source" ? (
                      <>
                        <SettingField label="Arabic">
                          <textarea
                            rows={6}
                            value={editingBite.sourcePrimaryText ?? ""}
                            onChange={(event) =>
                              setEditingBite((current) =>
                                current
                                  ? {
                                      ...current,
                                      sourcePrimaryText: event.target.value,
                                      biteText: event.target.value,
                                    }
                                  : current,
                              )
                            }
                            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                          />
                        </SettingField>

                        <SettingField
                          label={editingBite.sourceSecondaryLabel ?? editingBite.translationResourceName ?? "English translation"}
                        >
                          <textarea
                            rows={5}
                            value={editingBite.sourceSecondaryText ?? ""}
                            onChange={(event) =>
                              setEditingBite((current) =>
                                current ? { ...current, sourceSecondaryText: event.target.value } : current,
                              )
                            }
                            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                          />
                        </SettingField>

                        {editingBite.sourceTafsirText !== undefined ? (
                          <SettingField label={editingBite.sourceTafsirLabel ?? editingBite.tafsirResourceName ?? "Tafsir"}>
                            <textarea
                              rows={8}
                              value={editingBite.sourceTafsirText ?? ""}
                              onChange={(event) =>
                                setEditingBite((current) =>
                                  current ? { ...current, sourceTafsirText: event.target.value } : current,
                                )
                              }
                              className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                            />
                          </SettingField>
                        ) : null}
                      </>
                    ) : (
                      <SettingField label="Bite text">
                        <textarea
                          rows={14}
                          value={editingBite.biteText}
                          onChange={(event) =>
                            setEditingBite((current) => (current ? { ...current, biteText: event.target.value } : current))
                          }
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                        />
                      </SettingField>
                    )}

                  </div>
                </section>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-stone-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingBite(null)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateBite(editingBite.biteId, editingBite);
                  setEditingBite(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

type SettingFieldProps = {
  label: string;
  children: React.ReactNode;
};

const SettingField = ({ label, children }: SettingFieldProps) => (
  <label className="block text-sm text-slate-700">
    <span className="mb-2 block font-medium text-slate-900">{label}</span>
    {children}
  </label>
);
