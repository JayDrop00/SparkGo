import type { ReactNode } from "react";

export type BadgeTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const tones: Record<BadgeTone, string> = {
  accent: "border-theme-accent/40 bg-theme-accent/10 text-theme-accent",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  danger: "border-red-400/30 bg-red-400/10 text-red-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  neutral: "border-ink-border bg-ink-card/70 text-slate-300",
};

type Props = {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  title?: string;
};

export default function Badge({
  tone = "neutral",
  className = "",
  children,
  title,
}: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-data text-[11px] font-semibold tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
