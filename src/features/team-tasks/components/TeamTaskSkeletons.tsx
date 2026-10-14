"use client";

import React from "react";

export function TeamTaskCardSkeleton() {
  return (
    <div className="shimmer-mask rounded-xl border border-ink-border bg-ink-card p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[22px] w-[22px] rounded-md bg-ink-border" />
          <div className="h-4 w-12 rounded-md bg-ink-border" />
        </div>
        <div className="h-4 w-4 rounded bg-ink-border/70" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-3/4 rounded bg-ink-border" />
        <div className="h-3 w-1/2 rounded bg-ink-border/70" />
      </div>
      <div className="pt-2 border-t border-ink-border flex items-center justify-between">
        <div className="h-[22px] w-[22px] rounded-full bg-ink-border" />
        <div className="h-3 w-14 rounded bg-ink-border/70" />
      </div>
    </div>
  );
}

export function TeamTaskColumnSkeleton() {
  return (
    <div className="w-[295px] min-w-[295px] max-w-[295px] shrink-0 space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="h-4 w-28 rounded bg-ink-border" />
        <div className="h-4 w-6 rounded bg-ink-border/70" />
      </div>
      <div className="h-1 w-full rounded bg-ink-border/60" />
      <div className="min-h-[220px] rounded-2xl border border-ink-border bg-ink-surface/60 p-3.5 space-y-3">
        <TeamTaskCardSkeleton />
        <TeamTaskCardSkeleton />
      </div>
    </div>
  );
}

