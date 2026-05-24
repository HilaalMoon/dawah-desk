import { ReactNode } from "react";
import { classNames } from "@/utils/format";

type BadgeProps = {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "info" | "muted";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-stone-100 text-stone-700 border-stone-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
};

export const Badge = ({ children, tone = "default" }: BadgeProps) => (
  <span className={classNames("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone])}>
    {children}
  </span>
);
