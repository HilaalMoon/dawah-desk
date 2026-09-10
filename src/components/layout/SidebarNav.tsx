import { useEffect, useState } from "react";
import { BookOpen, ChevronsLeft, ChevronsRight, Database, FolderOpen, Home, PlusSquare, Settings } from "lucide-react";
import { classNames } from "@/utils/format";
import { LAST_UPDATED } from "@/buildInfo";
import packageJson from "../../../package.json";

type SidebarNavProps = {
  currentView: "home" | "new-case" | "workspace" | "library" | "case-detail" | "save-review" | "sources" | "settings";
  onSelect: (view: "home" | "new-case" | "workspace" | "library" | "sources" | "settings") => void;
};

const links: Array<{
  key: "home" | "new-case" | "workspace" | "library" | "sources" | "settings";
  label: string;
  icon: typeof Home;
  disabled?: boolean;
}> = [
  { key: "home", label: "Home", icon: Home },
  { key: "new-case", label: "New Case", icon: PlusSquare },
  { key: "workspace", label: "Workspace", icon: FolderOpen },
  { key: "library", label: "Case Library", icon: BookOpen },
  { key: "sources", label: "Sources", icon: Database },
  { key: "settings", label: "Settings", icon: Settings },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "dawah-sidebar-collapsed";

const formatTimestamp = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const lastUpdatedLabel = formatTimestamp(new Date(LAST_UPDATED));

export const SidebarNav = ({ currentView, onSelect }: SidebarNavProps) => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "true" : "false");
  }, [collapsed]);

  return (
    <aside
      className={classNames(
        "panel sticky top-4 flex h-[calc(100vh-2rem)] flex-col py-5",
        collapsed ? "w-[76px] px-2" : "w-[260px] px-4",
      )}
    >
      {collapsed ? (
        <div className="mb-6 flex flex-col items-center gap-3 border-b border-stone-200 pb-4">
          <img
            src="/dawah-desk-logo.png"
            alt="Da'wah Desk logo"
            title={`Da'wah Desk — Version ${packageJson.version}, last updated ${lastUpdatedLabel}`}
            className="h-10 w-10 rounded-xl border border-stone-200 object-cover shadow-sm"
          />
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700 hover:bg-stone-50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      ) : (
        <div className="mb-8 border-b border-stone-200 px-2 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/dawah-desk-logo.png"
                alt="Da'wah Desk logo"
                className="h-12 w-12 rounded-2xl border border-stone-200 object-cover shadow-sm"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Da'wah Desk</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="inline-flex shrink-0 items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700 hover:bg-stone-50"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Case Workspace</h1>
          <p className="mt-2 text-sm text-slate-600">
            Confidence-first research, reuse, and drafting for active da'wah cases.
          </p>
        </div>
      )}

      <nav className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = link.key === currentView;
          return (
            <button
              key={link.key}
              type="button"
              disabled={link.disabled}
              onClick={() =>
                !link.disabled &&
                (link.key === "home" ||
                  link.key === "new-case" ||
                  link.key === "workspace" ||
                  link.key === "library" ||
                  link.key === "sources" ||
                  link.key === "settings") &&
                onSelect(link.key)
              }
              aria-label={link.label}
              title={collapsed ? link.label : undefined}
              className={classNames(
                "flex w-full items-center rounded-xl text-sm font-medium transition",
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3 text-left",
                link.disabled && "cursor-not-allowed text-slate-400",
                isActive && "bg-slate-900 text-white shadow-sm",
                !isActive && !link.disabled && "text-slate-700 hover:bg-stone-100",
              )}
            >
              <Icon size={18} />
              {collapsed ? null : <span>{link.label}</span>}
            </button>
          );
        })}
      </nav>

      {collapsed ? null : (
        <div className="mt-auto rounded-2xl bg-mist px-4 py-4">
          <p className="text-sm font-semibold text-slate-800">Production Version</p>
          <div className="mt-3 space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
            <p>Version {packageJson.version}</p>
            <p>Last updated {lastUpdatedLabel}</p>
          </div>
        </div>
      )}
    </aside>
  );
};
