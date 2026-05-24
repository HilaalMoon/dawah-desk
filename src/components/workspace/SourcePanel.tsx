import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Languages, MessageSquareQuote, PlusCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SourceItem } from "@/types";
import { classNames } from "@/utils/format";

type SourcePanelProps = {
  sources: SourceItem[];
  allSources: SourceItem[];
  selectedSourceIds: string[];
  onAddSource: (sourceId: string) => void;
  onCopyText: (text: string, message?: string) => void;
  onTranslateSource: (sourceId: string) => void;
};

type SourceTab = "Quran" | "Sunnah" | "Scholarly" | "User";

const normalizeArabic = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

const normalizeForSearch = (value: string) => normalizeArabic(value).toLowerCase().trim();

const matchesQuery = (source: SourceItem, query: string) => {
  if (!query.trim()) return true;
  const haystack = normalizeForSearch(
    `${source.sourceTitle} ${source.excerpt} ${source.fullReference} ${source.authenticatedTranslation ?? ""} ${source.connectorName ?? ""}`,
  );
  return haystack.includes(normalizeForSearch(query));
};

const buildSourceCopyText = (source: SourceItem) =>
  `${source.sourceTitle}\n\n${source.excerpt}${
    source.authenticatedTranslation ? `\n\n${source.authenticatedTranslation}` : ""
  }${source.tafsirText ? `\n\n${source.tafsirResourceName ?? "Tafsir"}\n${source.tafsirText}` : ""}\n\n${source.fullReference}`;

const belongsToQuranTab = (source: SourceItem) =>
  source.sourceType === "quran" ||
  source.connectorId === "conn-quran-primary" ||
  source.connectorName === "Quran Foundation Adapter" ||
  source.connectorName === "Quran.com";

const belongsToSunnahTab = (source: SourceItem) =>
  source.sourceType === "hadith" ||
  source.connectorId === "connector-hadith" ||
  source.connectorName === "Sunnah connector";

const belongsToScholarlyTab = (source: SourceItem) =>
  source.sourceType === "scholarly-note" || source.sourceType === "article";

const belongsToUserTab = (source: SourceItem) => source.sourceType === "user-note";

export const SourcePanel = ({
  sources,
  allSources,
  selectedSourceIds,
  onAddSource,
  onCopyText,
  onTranslateSource,
}: SourcePanelProps) => {
  const [activeTab, setActiveTab] = useState<SourceTab>("Quran");
  const [sourceQuery, setSourceQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([]);

  const filteredSources = useMemo(() => {
    const baseList = appliedQuery.trim()
      ? allSources.filter((source) => matchesQuery(source, appliedQuery))
      : sources;

    return baseList.filter((source) => {
      if (activeTab === "Quran") return belongsToQuranTab(source);
      if (activeTab === "Sunnah") return belongsToSunnahTab(source);
      if (activeTab === "Scholarly") return belongsToScholarlyTab(source);
      return belongsToUserTab(source);
    });
  }, [activeTab, allSources, appliedQuery, sources]);

  const toggleExpanded = (sourceId: string) => {
    setExpandedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    );
  };

  return (
    <section
      id="workspace-source-panel"
      tabIndex={0}
      className="panel flex h-full min-h-0 flex-col px-5 py-5 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)]"
    >
      <div className="-mx-5 sticky top-0 z-10 bg-white/95 px-5 pb-4 backdrop-blur">
        <SectionTitle
          eyebrow="Source Panel"
          title="Quran, Sunnah, scholarly, and user support"
          description="This panel uses only the saved local source library. Retrieve new material in Sources first, then come back here to search and draft with it."
        />

        <div className="mb-4 flex gap-2">
          <label className="flex flex-1 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <Search size={16} className="text-slate-500" />
            <input
              value={sourceQuery}
              onChange={(event) => setSourceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setAppliedQuery(sourceQuery);
                }
              }}
              className="w-full border-none bg-transparent text-sm outline-none"
              placeholder="Search only saved local sources"
            />
          </label>
          <button
            type="button"
            onClick={() => setAppliedQuery(sourceQuery)}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
          >
            Search Sources
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceQuery("");
              setAppliedQuery("");
            }}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
          >
            Clear
          </button>
        </div>

        <div className="flex gap-2">
          {(["Quran", "Sunnah", "Scholarly", "User"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={classNames(
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                activeTab === tab ? "bg-slate-900 text-white" : "bg-stone-100 text-slate-700",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {appliedQuery ? (
          <p className="text-sm text-slate-600">
            Searching saved source library for <span className="font-semibold text-slate-900">"{appliedQuery}"</span>
          </p>
        ) : null}

        {filteredSources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
            No saved sources matched this search. Use the <span className="font-semibold text-slate-900">Sources</span> page to retrieve and save new source material first.
          </div>
        ) : null}

        {filteredSources.map((source) => {
              const selected = selectedSourceIds.includes(source.sourceId);
              const isExpanded = expandedSourceIds.includes(source.sourceId);
              const hasExpandableDetails =
                Boolean(source.authenticatedTranslation || source.tafsirText) || source.excerpt.length > 140;
              return (
                <div key={source.sourceId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasExpandableDetails) {
                            toggleExpanded(source.sourceId);
                          }
                        }}
                        className="min-w-0 flex-1 text-left"
                        aria-label={isExpanded ? "Collapse source details" : "Expand source details"}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{source.sourceTitle}</p>
                          <Badge tone={source.trustLevel === "high" ? "success" : "warning"}>{source.trustLevel}</Badge>
                          <Badge tone="muted">{source.sourceType}</Badge>
                          {source.translationAvailable ? (
                            <Badge tone="info">
                              <Languages size={12} className="mr-1 inline" />
                              translation available
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onCopyText(buildSourceCopyText(source))}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                          aria-label="Copy source"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTranslateSource(source.sourceId)}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                          aria-label="Copy translation or translate source"
                        >
                          <Languages size={16} />
                        </button>
                        {source.tafsirText ? (
                          <button
                            type="button"
                            onClick={() => onCopyText(source.tafsirText ?? "", "Copied tafsir note.")}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                            aria-label="Copy tafsir note"
                          >
                            <MessageSquareQuote size={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onAddSource(source.sourceId)}
                          className={classNames(
                            "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
                            selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-900 text-white",
                          )}
                        >
                          <PlusCircle size={16} />
                          {selected ? "Added" : "Add to draft"}
                        </button>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p
                        className={classNames(
                          "text-sm leading-6 text-slate-600",
                          !isExpanded && "line-clamp-2",
                        )}
                      >
                        {source.excerpt}
                      </p>
                      {hasExpandableDetails ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(source.sourceId)}
                          className="mt-3 inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700"
                          aria-label={isExpanded ? "Collapse source details" : "Expand source details"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      ) : null}
                      {isExpanded && source.authenticatedTranslation ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                            Saved English translation
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{source.authenticatedTranslation}</p>
                        </div>
                      ) : null}
                      {isExpanded && source.tafsirText ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                            {source.tafsirResourceName ?? "Saved tafsir note"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{source.tafsirText}</p>
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{source.fullReference}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
};
