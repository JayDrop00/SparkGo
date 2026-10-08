// Tiny external store for landing-page preferences (theme + sound).
// Used with useSyncExternalStore so SSR output stays stable and no
// setState-in-effect is needed to read localStorage.

export type ThemeName = "cyan" | "solar" | "violet";

export const THEMES: Record<ThemeName, { label: string; accent: string }> = {
  cyan: { label: "Cyber Cyan", accent: "#2dd4bf" },
  solar: { label: "Solar Orange", accent: "#f97316" },
  violet: { label: "Hyper Violet", accent: "#c084fc" },
};

const THEME_KEY = "sparkgo-theme";
const SFX_KEY = "sparkgo-sfx";
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, etc.)
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore: preference simply won't persist
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTheme(): ThemeName {
  const v = read(THEME_KEY);
  return v === "solar" || v === "violet" ? v : "cyan";
}

export function setTheme(theme: ThemeName) {
  write(THEME_KEY, theme);
  emit();
}

/** Sound effects are OFF until the visitor turns them on. */
export function getSfxOn(): boolean {
  return read(SFX_KEY) === "on";
}

export function setSfxOn(on: boolean) {
  write(SFX_KEY, on ? "on" : "off");
  emit();
}