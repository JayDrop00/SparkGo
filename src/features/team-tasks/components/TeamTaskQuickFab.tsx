"use client";

import React from "react";

export default function TeamTaskQuickFab({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quick create task"
      title="Create new task"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-theme-accent to-theme-secondary text-ink-base shadow-[0_12px_32px_rgb(var(--theme-rgb)/0.4)] transition-all duration-200 hover:scale-105 hover:shadow-[0_16px_40px_rgb(var(--theme-rgb)/0.55)] active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent cursor-pointer"
    >
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

