import { CheckCircle2, Info, X } from "lucide-react";
import { classNames } from "@/utils/format";

export type ToastItem = {
  id: string;
  message: string;
  tone?: "success" | "info";
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export const ToastViewport = ({ toasts, onDismiss }: ToastViewportProps) => (
  <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-3">
    {toasts.map((toast) => {
      const Icon = toast.tone === "info" ? Info : CheckCircle2;
      return (
        <div
          key={toast.id}
          className={classNames(
            "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-4 shadow-panel backdrop-blur",
            toast.tone === "info"
              ? "border-sky-200 bg-white/95 text-slate-800"
              : "border-emerald-200 bg-white/95 text-slate-800",
          )}
        >
          <Icon size={18} className={toast.tone === "info" ? "mt-0.5 text-sky-600" : "mt-0.5 text-emerald-600"} />
          <p className="flex-1 text-sm leading-6">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded-lg p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      );
    })}
  </div>
);
