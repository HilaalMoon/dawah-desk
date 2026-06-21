import { BookOpen, Database, FolderOpen, Home, PlusSquare, Settings, Sparkles } from "lucide-react";
import { classNames } from "@/utils/format";
import { LAST_UPDATED } from "@/buildInfo";
import packageJson from "../../../package.json";

type SidebarNavProps = {
  currentView: "home" | "new-case" | "workspace" | "library" | "case-detail" | "save-review" | "sources" | "settings" | "quick-aissist";
  onSelect: (view: "home" | "new-case" | "workspace" | "library" | "sources" | "settings" | "quick-aissist") => void;
};

const links: Array<{
  key: "home" | "new-case" | "workspace" | "library" | "sources" | "quick-aissist" | "settings";
  label: string;
  icon: typeof Home;
  disabled?: boolean;
}> = [
  { key: "home", label: "Home", icon: Home },
  { key: "new-case", label: "New Case", icon: PlusSquare },
  { key: "workspace", label: "Workspace", icon: FolderOpen },
  { key: "library", label: "Case Library", icon: BookOpen },
  { key: "sources", label: "Sources", icon: Database },
  { key: "quick-aissist", label: "Quick AIssist", icon: Sparkles },
  { key: "settings", label: "Settings", icon: Settings },
];

const formatTimestamp = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const lastUpdatedLabel = formatTimestamp(new Date(LAST_UPDATED));

export const SidebarNav = ({ currentView, onSelect }: SidebarNavProps) => {
  return (
    <aside className="panel sticky top-4 flex h-[calc(100vh-2rem)] w-[260px] flex-col px-4 py-5">
      <div className="mb-8 border-b border-stone-200 px-2 pb-4">
        <div className="flex items-center gap-3">
          <img
            src="/dawah-desk-logo.png"
            alt="Da'wah Desk logo"
            className="h-12 w-12 rounded-2xl border border-stone-200 object-cover shadow-sm"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Da'wah Desk</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Case Workspace</h1>
        <p className="mt-2 text-sm text-slate-600">
          Confidence-first research, reuse, and drafting for active da'wah cases.
        </p>
      </div>

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
                  link.key === "quick-aissist" ||
                  link.key === "settings") &&
                onSelect(link.key)
              }
              className={classNames(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition",
                link.disabled && "cursor-not-allowed text-slate-400",
                isActive && "bg-slate-900 text-white shadow-sm",
                !isActive && !link.disabled && "text-slate-700 hover:bg-stone-100",
              )}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-mist px-4 py-4">
        <p className="text-sm font-semibold text-slate-800">Production Version</p>
        <div className="mt-3 space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
          <p>Version {packageJson.version}</p>
          <p>Last updated {lastUpdatedLabel}</p>
        </div>
      </div>
    </aside>
  );
};
