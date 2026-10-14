"use client";

import React from "react";

export default function TeamTaskEmptyColumn({
  color,
  onAddTask,
}: {
  color?: string | null;
  onAddTask: () => void;
}) {
  const colColor = color || null;

  return (
    <button
      type="button"
      onClick={onAddTask}
      className="group/empty flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-border bg-white/[0.01] p-6 text-center transition-all duration-200 hover:border-theme-accent/50 hover:bg-white/[0.025] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent cursor-pointer"
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover/empty:scale-105"
        style={
          colColor
            ? {
                backgroundColor: `${colColor}20`,
                color: colColor,
                border: `1px solid ${colColor}35`,
              }
            : {
                backgroundColor: "rgb(var(--theme-rgb) / 0.12)",
                color: "var(--theme-accent)",
                border: "1px solid rgb(var(--theme-rgb) / 0.25)",
              }
        }
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>

      <p className="mt-2.5 text-sm font-semibold text-slate-400 group-hover/empty:text-white transition-colors">
        No tasks yet
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Drag tasks here or click + to add
      </p>
    </button>
  );
}

