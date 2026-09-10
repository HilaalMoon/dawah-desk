import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

type UtilityModalProps = {
  title: string;
  onClose: () => void;
  widthClassName?: string;
  children: ReactNode;
};

// Shared shell for top-bar utility modals (Sources, Quick AIssist, AI Translation).
// Sits at z-40 so the TranslationModal (z-50) can layer above it when opened from inside.
export const UtilityModal = ({ title, onClose, widthClassName = "max-w-3xl", children }: UtilityModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`flex w-full ${widthClassName} flex-col rounded-2xl bg-white shadow-xl`}
        style={{ maxHeight: "calc(100vh - 3rem)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-xl border border-stone-200 p-2 text-slate-500 hover:bg-stone-50 hover:text-slate-900"
            aria-label={`Close ${title}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
};
