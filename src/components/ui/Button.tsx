import type { ButtonHTMLAttributes, ReactNode } from "react";
import { focusRing } from "./styles";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary:
    "group inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-br from-theme-accent to-theme-secondary font-display font-extrabold uppercase tracking-wider text-ink-base shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgb(var(--theme-rgb)/0.6)] active:translate-y-px",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-card/70 font-semibold text-slate-200 backdrop-blur transition-colors hover:border-theme-accent hover:text-white",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-transparent text-slate-300 transition-colors hover:bg-ink-border/60 hover:text-white",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 font-semibold text-red-300 transition-colors hover:bg-red-400/20 hover:text-red-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} ${focusRing} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
