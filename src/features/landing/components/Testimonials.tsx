"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { playSfx } from "@/utils/sfx";
import HudCorners from "@/components/ui/HudCorners";
import Icon from "@/components/ui/Icon";

type Review = {
  key: string;
  name: string;
  role: string;
  company: string;
  initial: string;
  rating: number;
  quote: string;
  date: string;
};

// Sample reviews — swap for real user feedback here.
const REVIEWS: Review[] = [
  {
    key: "sarah",
    name: "Sarah Chen",
    role: "Engineering Manager",
    company: "Northwind",
    initial: "S",
    rating: 5,
    quote:
      "SparkGo replaced three tools for us. Sprint planning, reviews, and reminders all live in one place, and nothing slips through anymore.",
    date: "Sep 2026",
  },
  {
    key: "marco",
    name: "Marco Reyes",
    role: "Product Lead",
    company: "Lumen Labs",
    initial: "M",
    rating: 5,
    quote:
      "The progress views are the first ones my team actually opens. We ship faster because everyone knows what's next without asking.",
    date: "Aug 2026",
  },
  {
    key: "aiko",
    name: "Aiko Tanaka",
    role: "Design Director",
    company: "Palette",
    initial: "A",
    rating: 4,
    quote:
      "Clean, fast, and out of the way. Deadlines and hand-offs finally stay in sync across design and engineering.",
    date: "Aug 2026",
  },
];

const REVIEW_KEYS = REVIEWS.map((r) => r.key);
const STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

const summary = [
  { label: "Average rating", value: "4.9", tone: "text-theme-accent" },
  { label: "Five-star reviews", value: "94%", tone: "text-white" },
  { label: "Verified reviews", value: "1,284", tone: "text-white" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          className={`h-4 w-4 ${
            i <= rating ? "fill-current text-theme-accent" : "fill-none text-slate-600"
          }`}
        />
      ))}
    </span>
  );
}

/** Social-proof panel for the hero: rating summary + tabbed user reviews. */
export default function Testimonials() {
  const [active, setActive] = useState<string>("sarah");
  const cardRef = useRef<HTMLDivElement>(null);

  const review = REVIEWS.find((r) => r.key === active) ?? REVIEWS[0];

  const selectReview = (key: string) => {
    setActive(key);
    playSfx("tab");
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const next = REVIEW_KEYS[(index + step + REVIEW_KEYS.length) % REVIEW_KEYS.length];
    selectReview(next);
    document.getElementById(`review-tab-${next}`)?.focus();
  };

  // 3D tilt only while a mouse is over the card (never on touch / reduced motion)
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    el.style.transform = `rotateX(${-y * 10}deg) rotateY(${x * 10}deg)`;
  };
  const resetTilt = () => {
    if (cardRef.current) cardRef.current.style.transform = "";
  };

  return (
    <div style={{ perspective: "1200px" }}>
      <div
        ref={cardRef}
        onPointerMove={onPointerMove}
        onPointerLeave={resetTilt}
        className="hud-card relative rounded-3xl p-5 transition-transform duration-150 ease-out will-change-transform sm:p-6"
      >
        <HudCorners />

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="truncate font-data text-xs font-semibold text-white">What crews are saying</p>
          <span className="flex items-center gap-1.5 font-data text-[11px] text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Verified reviews
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded-2xl border border-ink-border bg-ink-surface/90 p-3">
              <p className="min-h-8 font-data text-[11px] leading-4 text-slate-400">{s.label}</p>
              <p className={`mt-0.5 truncate font-display text-base font-black sm:text-lg ${s.tone}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div
          role="tablist"
          aria-label="Reviewer"
          className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-ink-border bg-ink-input/90 p-1"
        >
          {REVIEWS.map((r, i) => (
            <button
              key={r.key}
              id={`review-tab-${r.key}`}
              type="button"
              role="tab"
              aria-selected={active === r.key}
              aria-controls="review-panel"
              tabIndex={active === r.key ? 0 : -1}
              onClick={() => selectReview(r.key)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                active === r.key
                  ? "bg-theme-accent text-ink-base shadow-md"
                  : "text-slate-300 hover:text-white"
              } ${focusRing}`}
            >
              {r.name.split(" ")[0]}
            </button>
          ))}
        </div>

        <div
          id="review-panel"
          role="tabpanel"
          aria-labelledby={`review-tab-${active}`}
          className="rounded-2xl border border-ink-border bg-ink-surface/90 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Stars rating={review.rating} />
            <span className="font-data text-xs text-slate-400">
              {review.rating.toFixed(1)} / 5.0
            </span>
          </div>

          <blockquote className="mt-3 text-sm leading-6 text-slate-200">
            “{review.quote}”
          </blockquote>

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-ink-border pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-accent/20 text-xs font-bold text-theme-accent ring-1 ring-theme-accent"
              >
                {review.initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{review.name}</p>
                <p className="truncate font-data text-[11px] text-slate-400">
                  {review.role} · {review.company}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-data text-[11px] text-slate-400">{review.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
