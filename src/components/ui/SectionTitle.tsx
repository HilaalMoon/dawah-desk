import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export const SectionTitle = ({ eyebrow, title, description, action }: SectionTitleProps) => (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-olive">{eyebrow}</p> : null}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description ? (
          <span
            title={description}
            aria-label={description}
            className="inline-flex cursor-help items-center justify-center rounded-full border border-stone-200 bg-white p-1 text-slate-400 transition hover:text-slate-700"
          >
            <CircleHelp size={15} />
          </span>
        ) : null}
      </div>
    </div>
    {action}
  </div>
);
