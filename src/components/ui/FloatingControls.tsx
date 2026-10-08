"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  THEMES,
  getSfxOn,
  getTheme,
  setSfxOn,
  setTheme,
  subscribe,
  type ThemeName,
} from "@/lib/prefs";
import { playSfx } from "@/lib/sfx";
import HudCorners from "./HudCorners";
import Icon from "./Icon";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent";

const PANEL_ID = "display-settings-panel";
const THEME_KEYS = Object.keys(THEMES) as ThemeName[];
const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** App-wide theme picker + sound toggle (mounted once in the root layout). */
export default function FloatingControls() {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribe, getTheme, (): ThemeName => "cyan");
  const sfxOn = useSyncExternalStore(subscribe, getSfxOn, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Applied app-wide; deliberately no cleanup so the theme survives route changes.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Escape closes the panel and returns focus to the FAB.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Click/tap outside closes (focus stays with whatever the user clicked).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  const pickTheme = (key: ThemeName) => {
    setTheme(key);
    playSfx("click");
  };

  const toggleSfx = () => {
    const next = !sfxOn;
    setSfxOn(next);
    if (next) playSfx("click");
  };

  // Tabbing past the last control closes the panel; the FAB is next in DOM order.
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    const items = panelRef.current?.querySelectorAll("button");
    if (items && items[items.length - 1] === document.activeElement) setOpen(false);
  };

  // Arrow keys move + select within the theme radiogroup.
  const onGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const next = THEME_KEYS[(THEME_KEYS.indexOf(theme) + step + THEME_KEYS.length) % THEME_KEYS.length];
    pickTheme(next);
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-theme-key="${next}"]`)?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="fixed z-40"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        right: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* Stays mounted (visibility-hidden when closed) so closing can animate too. */}
      <div
        ref={panelRef}
        id={PANEL_ID}
        role="dialog"
        aria-label="Display settings"
        onKeyDown={onPanelKeyDown}
        className={`hud-card absolute bottom-full right-0 mb-3 w-60 max-w-[calc(100vw-2rem)] origin-bottom-right rounded-2xl p-3 transition-[opacity,transform,visibility] duration-200 motion-reduce:transition-none ${
          open
            ? "opacity-100"
            : "pointer-events-none invisible translate-y-1 scale-95 opacity-0"
        }`}
      >
        <HudCorners />

        <p className="px-1 font-data text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Theme
        </p>
        <div role="radiogroup" aria-label="Theme" onKeyDown={onGroupKeyDown} className="mt-1.5 space-y-1">
          {THEME_KEYS.map((key) => {
            const selected = theme === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                data-theme-key={key}
                tabIndex={selected ? 0 : -1}
                onClick={() => pickTheme(key)}
                className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 text-left text-sm font-semibold transition-colors ${
                  selected
                    ? "border-theme-accent/60 bg-theme-accent/10 text-white"
                    : "border-transparent text-slate-300 hover:bg-ink-border/60 hover:text-white"
                } ${focusRing}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/20 ${
                    selected ? "ring-2 ring-white/80" : ""
                  }`}
                  style={{ backgroundColor: THEMES[key].accent }}
                >
                  {selected && <Icon name="check" className="h-3.5 w-3.5 text-ink-base" />}
                </span>
                {THEMES[key].label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 border-t border-ink-border/70 pt-2">
          <button
            type="button"
            role="switch"
            aria-checked={sfxOn}
            onClick={toggleSfx}
            className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 text-sm font-semibold transition-colors ${
              sfxOn
                ? "border-theme-accent/60 bg-theme-accent/10 text-white"
                : "border-transparent text-slate-300 hover:bg-ink-border/60 hover:text-white"
            } ${focusRing}`}
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/20 bg-ink-input"
            >
              <Icon name={sfxOn ? "volume" : "mute"} className="h-4 w-4 text-slate-300" />
            </span>
            <span className="flex-1 text-left">Sound effects</span>
            <span className={`font-data text-xs ${sfxOn ? "text-theme-accent" : "text-slate-400"}`}>
              {sfxOn ? "On" : "Off"}
            </span>
          </button>
        </div>
      </div>

      <button
        ref={fabRef}
        type="button"
        aria-label={open ? "Close display settings" : "Open display settings"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((o) => !o)}
        className={`ml-auto flex h-12 w-12 items-center justify-center rounded-full border border-theme-accent/40 bg-ink-card/90 text-slate-200 shadow-[0_0_16px_rgb(var(--theme-rgb)/0.3)] backdrop-blur-xl transition-colors hover:border-theme-accent/70 hover:text-white ${focusRing}`}
      >
        <Icon name={open ? "close" : "sliders"} className="h-5 w-5" />
      </button>
    </div>
  );
}
