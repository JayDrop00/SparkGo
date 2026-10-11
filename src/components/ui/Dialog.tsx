"use client";

import { useEffect, useRef, type ReactNode } from "react";
import HudCorners from "./HudCorners";
import Icon from "./Icon";
import { focusRing } from "./styles";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-xl",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "[autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex='-1']), [href], [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((item) => !item.hasAttribute("disabled") && item.tabIndex >= 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-base/85 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`hud-card relative max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl p-6 sm:p-7`}
      >
        <HudCorners />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-wide text-white">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`rounded-lg border border-ink-border bg-ink-card/70 p-1.5 text-slate-400 transition-colors hover:border-theme-accent/60 hover:text-white ${focusRing}`}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-ink-border/70 pt-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
