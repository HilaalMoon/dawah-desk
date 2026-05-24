import { Pin, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ActiveCaseTab, CaseRecord } from "@/types";
import { classNames, formatRelativeDate } from "@/utils/format";

type ActiveCaseTabsProps = {
  tabs: ActiveCaseTab[];
  cases: CaseRecord[];
  currentCaseId: string | null;
  onSelect: (caseId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
};

export const ActiveCaseTabs = ({
  tabs,
  cases,
  currentCaseId,
  onSelect,
  onCloseTab,
  onTogglePin,
}: ActiveCaseTabsProps) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const caseItem = cases.find((item) => item.caseId === tab.caseId);
        const isActive = currentCaseId === tab.caseId;

        return (
          <button
            key={tab.tabId}
            type="button"
            onClick={() => onSelect(tab.caseId)}
            className={classNames(
              "min-w-[208px] rounded-xl border px-3 py-2.5 text-left transition",
              isActive ? "border-slate-900 bg-slate-900 text-white" : "border-stone-200 bg-white hover:border-stone-300",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold leading-5">{tab.tabTitle}</p>
                <p className={classNames("mt-0.5 text-[11px]", isActive ? "text-slate-300" : "text-slate-500")}>
                  {caseItem?.personName || ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={tab.isPinned ? "Unpin case tab" : "Pin case tab"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePin(tab.tabId);
                  }}
                  className="rounded-md p-1 hover:bg-black/5"
                >
                  <Pin size={14} className={tab.isPinned ? "text-gold" : isActive ? "text-slate-300" : "text-slate-400"} />
                </button>
                <button
                  type="button"
                  aria-label="Close case tab"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!tab.isPinned) {
                      onCloseTab(tab.tabId);
                    }
                  }}
                  className="rounded-md p-1 hover:bg-black/5"
                >
                  <X size={14} className={isActive ? "text-slate-300" : "text-slate-400"} />
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              {tab.unsavedChangesFlag ? (
                <Badge tone={isActive ? "warning" : "info"}>Unsaved changes</Badge>
              ) : (
                <Badge tone="muted">Synced</Badge>
              )}
              {tab.isPinned ? <Badge tone="default">Pinned</Badge> : null}
            </div>

            <p className={classNames("mt-2 text-[11px]", isActive ? "text-slate-300" : "text-slate-500")}>
              Last active {formatRelativeDate(tab.lastActiveTimestamp)}
            </p>
          </button>
        );
      })}
  </div>
);
