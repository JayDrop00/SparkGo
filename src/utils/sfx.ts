import { getSfxOn } from "./prefs";

export type SfxKind = "click" | "tab" | "launch";

const PRESETS: Record<
  SfxKind,
  { type: OscillatorType; from: number; to: number; dur: number; vol: number }
> = {
  click: { type: "sine", from: 900, to: 450, dur: 0.05, vol: 0.08 },
  tab: { type: "triangle", from: 400, to: 800, dur: 0.08, vol: 0.06 },
  launch: { type: "sawtooth", from: 120, to: 1100, dur: 0.6, vol: 0.12 },
};

let ctx: AudioContext | null = null;

/** Synthesized sci-fi blips via Web Audio. No-ops unless the visitor enabled sound. */
export function playSfx(kind: SfxKind) {
  if (typeof window === "undefined" || !getSfxOn()) return;

  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;

  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();

  const p = PRESETS[kind];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = p.type;
  osc.frequency.setValueAtTime(p.from, now);
  osc.frequency.exponentialRampToValueAtTime(p.to, now + p.dur);
  gain.gain.setValueAtTime(p.vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + p.dur);
}