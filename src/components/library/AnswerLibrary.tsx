import { ChevronDown, ChevronUp, Download, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, ResponseBite } from "@/types";
import { CaseExportFile } from "@/types/backend";
import { downloadCsv } from "@/utils/csv";
import { ImportCasesModal } from "@/components/library/ImportCasesModal";

type AnswerLibraryProps = {
  cases: CaseRecord[];
  bitesByCase: Record<string, ResponseBite[]>;
  onOpenCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onImportCases: (parsed: CaseExportFile) => Promise<void>;
};

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/['''‘’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const AnswerLibrary = ({ cases, bitesByCase, onOpenCase, onDeleteCase, onImportCases }: AnswerLibraryProps) => {
  const [expandedCaseIds, setExpandedCaseIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [importModalData, setImportModalData] = useState<CaseExportFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [openDropdownCaseId, setOpenDropdownCaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openDropdownCaseId) return;
    const handleClickOutside = () => setOpenDropdownCaseId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownCaseId]);

  const toggleExpanded = (caseId: string) => {
    setExpandedCaseIds((current) =>
      current.includes(caseId) ? current.filter((id) => id !== caseId) : [...current, caseId],
    );
  };

  const availableTopics = [...new Set(cases.map((caseItem) => caseItem.topic).filter(Boolean))].sort();
  const availableAudienceTypes = [...new Set(cases.map((caseItem) => caseItem.audienceType).filter(Boolean))].sort();
  const filteredCases = [...cases]
    .filter((caseItem) => {
      const haystack = `${caseItem.title} ${caseItem.originalQuestion} ${caseItem.topic} ${caseItem.audienceType}`.toLowerCase();
      const queryMatch = !query.trim() || haystack.includes(query.toLowerCase());
      const topicMatch = topicFilter === "all" || caseItem.topic === topicFilter;
      const audienceMatch = audienceFilter === "all" || caseItem.audienceType === audienceFilter;
      return queryMatch && topicMatch && audienceMatch;
    })
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));

  const exportCaseAsJson = (caseItem: CaseRecord, bites: ResponseBite[]) => {
    const content: CaseExportFile = {
      exportedAt: new Date().toISOString(),
      exportedBy: "Da'wah Desk",
      version: 1,
      case: {
        title: caseItem.title,
        originalQuestion: caseItem.originalQuestion,
        contextNote: caseItem.contextNote,
        topic: caseItem.topic,
        audienceType: caseItem.audienceType,
        questionType: caseItem.questionType,
        difficulty: caseItem.difficulty,
        likelyIntent: caseItem.likelyIntent,
        platform: caseItem.platform,
        personName: caseItem.personName,
      },
      bites: [...bites]
        .sort((a, b) => a.biteOrder - b.biteOrder)
        .map((bite) => ({
          biteOrder: bite.biteOrder,
          biteTitle: bite.biteTitle,
          biteText: bite.biteText,
          bitePurpose: bite.bitePurpose,
          sourceCategory: bite.sourceCategory,
          supportStatus: bite.supportStatus,
          aiAssisted: bite.aiAssisted,
          translationUsed: bite.translationUsed,
          structuredSourceLayout: bite.structuredSourceLayout,
          sourcePrimaryText: bite.sourcePrimaryText,
          sourceSecondaryText: bite.sourceSecondaryText,
          translationResourceName: bite.translationResourceName,
          sourceTafsirText: bite.sourceTafsirText,
          tafsirResourceName: bite.tafsirResourceName,
          notes: bite.notes,
        })),
    };

    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dawah-desk-case-${slugify(caseItem.title)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setFileError("This doesn't look like a valid export file. Make sure you selected a Da'wah Desk case export.");
      return;
    }

    const asRecord = parsed as Record<string, unknown>;
    const caseContent = asRecord.case as Record<string, unknown> | undefined;

    if (!caseContent?.title || !caseContent?.originalQuestion) {
      setFileError("This file does not appear to be a Da'wah Desk case export.");
      return;
    }

    setImportModalData(parsed as CaseExportFile);
  };

  const exportCasesCsv = (caseItem: CaseRecord, caseBites: ResponseBite[]) => {
    downloadCsv(
      `${slugify(caseItem.title)}-export.csv`,
      caseBites.map((bite) => ({
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
    <input
      ref={fileInputRef}
      type="file"
      accept=".json"
      className="hidden"
      onChange={(event) => void handleFileSelected(event)}
    />
    {importModalData ? (
      <ImportCasesModal
        parsed={importModalData}
        cases={cases}
        onConfirm={() => onImportCases(importModalData)}
        onClose={() => setImportModalData(null)}
      />
    ) : null}
    <div className="space-y-6">
    <section className="panel px-6 py-6">
      <SectionTitle
        title="Case Library"
        description="The library supports bite previews and reuse, not only long-answer storage."
        action={
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {filteredCases.length} {filteredCases.length === 1 ? "case" : "cases"}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-900"
              aria-label="Import case"
              title="Import"
            >
              <Upload size={16} />
            </button>
          </div>
        }
      />
      {fileError ? (
        <p className="mb-3 text-sm text-red-600">{fileError}</p>
      ) : null}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr,0.8fr,0.8fr]">
        <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border-none bg-transparent text-sm outline-none"
            placeholder="Filter case library"
          />
        </label>
        <select
          value={topicFilter}
          onChange={(event) => setTopicFilter(event.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="all">All Topics</option>
          {availableTopics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
        <select
          value={audienceFilter}
          onChange={(event) => setAudienceFilter(event.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="all">All Audience Types</option>
          {availableAudienceTypes.map((audience) => (
            <option key={audience} value={audience}>
              {audience}
            </option>
          ))}
        </select>
      </div>
      {filteredCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">No cases matched these filters</p>
          <p className="mt-2 text-sm text-slate-600">
            Try a broader query or clear one of the library filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
        {filteredCases.map((caseItem) => (
          <div
            key={caseItem.caseId}
            className="rounded-2xl border border-stone-200 bg-white px-5 py-5 text-left hover:border-stone-300"
          >
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                onClick={() => toggleExpanded(caseItem.caseId)}
                className="min-w-0 flex-1 text-left"
                aria-label={expandedCaseIds.includes(caseItem.caseId) ? "Collapse case preview" : "Expand case preview"}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{caseItem.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-700">{caseItem.originalQuestion}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="info">{caseItem.topic}</Badge>
                    <Badge tone="muted">{caseItem.audienceType}</Badge>
                    <Badge tone="success">{caseItem.confidenceStatus} confidence</Badge>
                    <Badge tone="default">{caseItem.accessCount ?? 0} opens</Badge>
                  </div>
                </div>
              </button>
              <div className="flex items-start gap-3">
                <div className="text-right text-sm text-slate-500">
                  <p>{(bitesByCase[caseItem.caseId] ?? []).length} bites</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenCase(caseItem.caseId);
                  }}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  aria-label={`Open saved case ${caseItem.title}`}
                >
                  Open
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenDropdownCaseId(
                        openDropdownCaseId === caseItem.caseId ? null : caseItem.caseId,
                      );
                    }}
                    className="rounded-xl border border-stone-200 bg-white p-2 text-slate-700"
                    aria-label={`Export options for ${caseItem.title}`}
                    title="Export"
                  >
                    <Download size={16} />
                  </button>
                  {openDropdownCaseId === caseItem.caseId ? (
                    <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          exportCaseAsJson(caseItem, bitesByCase[caseItem.caseId] ?? []);
                          setOpenDropdownCaseId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"
                      >
                        Export as JSON
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          exportCasesCsv(caseItem, bitesByCase[caseItem.caseId] ?? []);
                          setOpenDropdownCaseId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"
                      >
                        Export as CSV
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpanded(caseItem.caseId)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                  aria-label={expandedCaseIds.includes(caseItem.caseId) ? "Collapse case preview" : "Expand case preview"}
                >
                  {expandedCaseIds.includes(caseItem.caseId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteCase(caseItem.caseId);
                  }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600"
                  aria-label={`Delete saved case ${caseItem.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {expandedCaseIds.includes(caseItem.caseId) ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {(bitesByCase[caseItem.caseId] ?? []).slice(0, 4).map((bite) => (
                  <div key={bite.biteId} className="rounded-xl bg-stone-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{bite.biteTitle}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-700">{bite.biteText}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        </div>
      )}
    </section>
    </div>
  </>
  );
};
