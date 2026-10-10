"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import HudCorners from "./HudCorners";
import { focusRing } from "./styles";

export type MenuItem = {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  items: MenuItem[];
  ariaLabel: string;
  triggerClassName?: string;
  children?: ReactNode;
};

export default function DropdownMenu({
  items,
  ariaLabel,
  triggerClassName = "",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector("button")?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={`rounded-lg border border-ink-border bg-ink-card/70 p-1.5 text-slate-400 transition-colors hover:border-theme-accent/60 hover:text-white ${focusRing} ${triggerClassName}`}
      >
        {children ?? <Icon name="sliders" className="h-4 w-4" />}
      </button>
      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        className={`hud-card absolute right-0 top-full z-30 mt-2 w-48 origin-top-right rounded-2xl p-1.5 transition-[opacity,transform,visibility] duration-150 ${
          open
            ? "opacity-100"
            : "pointer-events-none invisible translate-y-1 scale-95 opacity-0"
        }`}
      >
        <HudCorners />
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-left text-sm font-semibold transition-colors ${
              item.danger
                ? "text-red-300 hover:border-red-400/30 hover:bg-red-400/10"
                : "text-slate-300 hover:bg-ink-border/60 hover:text-white"
            } ${focusRing} disabled:opacity-40`}
          >
            {item.icon && <Icon name={item.icon} className="h-4 w-4 shrink-0" />}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
