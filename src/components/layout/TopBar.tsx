import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Languages, Search, Sparkles } from "lucide-react";
import { ActiveCaseTabs } from "@/components/home/ActiveCaseTabs";
import { ActiveCaseTab, CaseRecord } from "@/types";

type TopBarProps = {
  title: string;
  searchTerm: string;
  onSearch: (term: string) => void;
  searchMatches: CaseRecord[];
  onOpenSearchCase: (caseId: string) => void;
  actions?: ReactNode;
  onHelpOpen: () => void;
  onOpenQuickAssist: () => void;
  onOpenTranslation: () => void;
  activeTabs: ActiveCaseTab[];
  cases: CaseRecord[];
  currentCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
};

const OPEN_CASES_STORAGE_KEY = "dawah-open-cases-collapsed";

export const TopBar = ({
  title,
  searchTerm,
  onSearch,
  searchMatches,
  onOpenSearchCase,
  actions,
  onHelpOpen,
  onOpenQuickAssist,
  onOpenTranslation,
  activeTabs,
  cases,
  currentCaseId,
  onSelectCase,
  onCloseTab,
  onTogglePin,
}: TopBarProps) => {
  const [openCasesCollapsed, setOpenCasesCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OPEN_CASES_STORAGE_KEY) === "true";
  });
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OPEN_CASES_STORAGE_KEY, openCasesCollapsed ? "true" : "false");
  }, [openCasesCollapsed]);

  // Publish the top bar's bottom edge (it sticks at top-4 = 16px and its height
  // changes with the Open Cases strip) so other pinned elements — e.g. the
  // Response Builder header — can stick just below it instead of underneath it.
  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof window === "undefined") return;
    const updateOffset = () => {
      document.documentElement.style.setProperty("--topbar-offset", `${element.offsetHeight + 16 + 8}px`);
    };
    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="panel sticky top-4 z-20 mb-6 w-full px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {activeTabs.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpenCasesCollapsed((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              aria-label={openCasesCollapsed ? "Expand open cases" : "Collapse open cases"}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Open Cases</span>
              {openCasesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={onOpenQuickAssist}
              className="inline-flex items-center rounded-lg bg-white p-2 text-slate-700 shadow-sm hover:bg-stone-100"
              aria-label="Open Quick AIssist"
              title="Quick AIssist"
            >
              <Sparkles size={16} />
            </button>
            <button
              type="button"
              onClick={onOpenTranslation}
              className="inline-flex items-center rounded-lg bg-white p-2 text-slate-700 shadow-sm hover:bg-stone-100"
              aria-label="Open AI Translation"
              title="AI Translation"
            >
              <Languages size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={onHelpOpen}
            className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700 hover:bg-stone-50"
            aria-label="Open help"
            title="Help"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      <div className={openCasesCollapsed ? "mt-3" : "mt-4 space-y-3"}>
        {!openCasesCollapsed && activeTabs.length > 0 ? (
          <div className="min-w-0">
          <ActiveCaseTabs
            tabs={activeTabs}
            cases={cases}
            currentCaseId={currentCaseId}
            onSelect={onSelectCase}
            onCloseTab={onCloseTab}
            onTogglePin={onTogglePin}
          />
          </div>
        ) : null}

        {!openCasesCollapsed ? (
        <div className="relative w-full">
          <label className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <Search size={16} className="text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
              className="w-full border-none bg-transparent text-sm outline-none"
              placeholder="Search cases, topics, bites, or tags"
            />
          </label>
          {searchTerm.trim() && searchMatches.length > 0 ? (
            <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
              {searchMatches.map((caseItem) => (
                <button
                  key={caseItem.caseId}
                  type="button"
                  onClick={() => onOpenSearchCase(caseItem.caseId)}
                  className="block w-full rounded-xl px-3 py-3 text-left hover:bg-stone-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{caseItem.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{caseItem.originalQuestion}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </header>
  );
};
