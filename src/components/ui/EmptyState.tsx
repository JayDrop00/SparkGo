import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({
  icon = "layers",
  title,
  description,
  action,
  className = "",
}: Props) {
  return (
    <div
      className={`hud-card flex flex-col items-center justify-center rounded-3xl px-6 py-12 text-center ${className}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-theme-accent/40 bg-theme-accent/10 text-theme-accent">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-base font-bold tracking-wide text-white">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
