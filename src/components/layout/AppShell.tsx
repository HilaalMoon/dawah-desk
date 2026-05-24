import { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveCaseTab, CaseRecord } from "@/types";

type AppShellProps = {
  currentView: "home" | "new-case" | "workspace" | "library" | "case-detail" | "save-review" | "sources" | "settings" | "quick-aissist";
  title: string;
  searchTerm: string;
  onSearch: (term: string) => void;
  searchMatches: CaseRecord[];
  onOpenSearchCase: (caseId: string) => void;
  onNavigate: (view: "home" | "new-case" | "workspace" | "library" | "sources" | "settings" | "quick-aissist") => void;
  topBarActions?: ReactNode;
  onHelpOpen: () => void;
  activeTabs: ActiveCaseTab[];
  cases: CaseRecord[];
  currentCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  children: ReactNode;
  overlays?: ReactNode;
  apiStatusMessage?: string | null;
};

export const AppShell = ({
  currentView,
  title,
  searchTerm,
  onSearch,
  searchMatches,
  onOpenSearchCase,
  onNavigate,
  topBarActions,
  onHelpOpen,
  activeTabs,
  cases,
  currentCaseId,
  onSelectCase,
  onCloseTab,
  onTogglePin,
  children,
  overlays,
  apiStatusMessage,
}: AppShellProps) => (
  <div className="min-h-screen px-4 py-4">
    <div className="mx-auto flex max-w-[1600px] gap-4">
      <SidebarNav currentView={currentView} onSelect={onNavigate} />
      <div className="min-w-0 flex-1">
        <TopBar
          title={title}
          searchTerm={searchTerm}
          onSearch={onSearch}
          searchMatches={searchMatches}
          onOpenSearchCase={onOpenSearchCase}
          actions={topBarActions}
          onHelpOpen={onHelpOpen}
          activeTabs={activeTabs}
          cases={cases}
          currentCaseId={currentCaseId}
          onSelectCase={onSelectCase}
          onCloseTab={onCloseTab}
          onTogglePin={onTogglePin}
        />
        {apiStatusMessage ? (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <LoaderCircle size={16} className="animate-spin" />
            <span>{apiStatusMessage}</span>
          </div>
        ) : null}
        <main>{children}</main>
      </div>
    </div>
    {overlays}
  </div>
);
