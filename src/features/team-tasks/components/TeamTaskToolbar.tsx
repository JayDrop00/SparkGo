"use client";

import React, { useState, useRef, useEffect } from "react";
import type { TeamTaskMemberDto } from "../dto/team-task.dto";

type TaskView = "active" | "completed" | "archived";

export type BoardFilter = {
  type: "none" | "overdue" | "status" | "priority" | "assignee" | "help";
  value?: string;
  label?: string;
};

export default function TeamTaskToolbar({
  searchQuery,
  onSearchChange,
  view,
  onViewChange,
  activeCount,
  completedCount,
  archivedCount,
  canManage,
  onCreateTask,
  onAddGroup,
  activeFilter,
  onClearFilter,
  members,
  onApplyFilter,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  view: TaskView;
  onViewChange: (view: TaskView) => void;
  activeCount: number;
  completedCount: number;
  archivedCount: number;
  canManage: boolean;
  onCreateTask: () => void;
  onAddGroup: () => void;
  activeFilter: BoardFilter;
  onClearFilter: () => void;
  members: TeamTaskMemberDto[];
  onApplyFilter: (filter: BoardFilter) => void;
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setFilterMenuOpen(false);
      }
    }
    if (filterMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterMenuOpen]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left side: Search input + Filters dropdown */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search input (rounded, icon on left) */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              aria-label="Search tasks"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-xl border border-ink-border bg-ink-input py-2 pl-9 pr-8 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-theme-accent/50 focus:border-theme-accent focus:ring-4 focus:ring-theme-accent/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters dropdown button */}
          <div className="relative" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setFilterMenuOpen((v) => !v)}
              aria-expanded={filterMenuOpen}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeFilter.type !== "none"
                  ? "border-theme-accent/50 bg-theme-accent/10 text-theme-accent"
                  : "border-ink-border bg-ink-card text-slate-400 hover:border-theme-accent/50 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  filterMenuOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Filter Menu Popover */}
            {filterMenuOpen && (
              <div className="hud-card absolute left-0 top-full z-30 mt-2 w-56 rounded-xl p-2">
                <div className="px-2 py-1.5 font-data text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Filter by Priority
                </div>
                {(["urgent", "high", "medium", "low"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onApplyFilter({ type: "priority", value: p, label: `Priority: ${p}` });
                      setFilterMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-ink-border/60 hover:text-white"
                  >
                    <span className="capitalize">{p}</span>
                    {activeFilter.type === "priority" && activeFilter.value === p && (
                      <span className="text-theme-accent">✓</span>
                    )}
                  </button>
                ))}

                <div className="my-1 border-t border-ink-border" />

                <div className="px-2 py-1.5 font-data text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Special Status
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyFilter({ type: "overdue", label: "Overdue tasks" });
                    setFilterMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-ink-border/60 hover:text-rose-300"
                >
                  <span>Overdue</span>
                  {activeFilter.type === "overdue" && <span className="text-rose-400">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyFilter({ type: "help", label: "Help needed" });
                    setFilterMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-ink-border/60 hover:text-amber-300"
                >
                  <span>Help needed</span>
                  {activeFilter.type === "help" && <span className="text-amber-400">✓</span>}
                </button>

                {members.length > 0 && (
                  <>
                    <div className="my-1 border-t border-ink-border" />
                    <div className="px-2 py-1.5 font-data text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Filter by Member
                    </div>
                    {members.slice(0, 5).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onApplyFilter({
                            type: "assignee",
                            value: m.id,
                            label: `Assigned: ${m.name || "Member"}`,
                          });
                          setFilterMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between truncate rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-ink-border/60 hover:text-white"
                      >
                        <span className="truncate">{m.name || `User ${m.id.slice(0, 5)}`}</span>
                        {activeFilter.type === "assignee" && activeFilter.value === m.id && (
                          <span className="text-theme-accent">✓</span>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {activeFilter.type !== "none" && (
                  <>
                    <div className="my-1 border-t border-ink-border" />
                    <button
                      type="button"
                      onClick={() => {
                        onClearFilter();
                        setFilterMenuOpen(false);
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Active / Completed / Archived segmented control (pill group) */}
          <div
            role="tablist"
            aria-label="Task view filter"
            className="flex items-center rounded-xl border border-ink-border bg-ink-input p-1"
          >
            {(
              [
                { id: "active", label: "Active", count: activeCount },
                { id: "completed", label: "Completed", count: completedCount },
                { id: "archived", label: "Archived", count: archivedCount },
              ] as const
            ).map((item) => {
              const selected = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    selected
                      ? "bg-theme-accent/10 text-theme-accent shadow-xs"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      selected
                        ? "bg-theme-accent/15 text-theme-accent"
                        : "bg-ink-border/60 text-slate-500"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          {canManage && (
            <>
              {/* Add group secondary button */}
              <button
                type="button"
                onClick={onAddGroup}
                className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-transparent px-3.5 py-2 text-sm font-medium text-slate-200 transition-all hover:border-theme-accent/50 hover:bg-ink-border/50"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Add group</span>
              </button>

              {/* Create new task primary button */}
              <button
                type="button"
                onClick={onCreateTask}
                className="flex items-center gap-1.5 rounded-xl bg-linear-to-br from-theme-accent to-theme-secondary px-4 py-2 text-sm font-semibold text-ink-base shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgb(var(--theme-rgb)/0.6)] active:translate-y-px cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create new task</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dismissible Active Filter Chip */}
      {activeFilter.type !== "none" && (
        <div className="flex items-center gap-2 pt-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-theme-accent/30 bg-theme-accent/10 px-3 py-1 text-xs font-semibold text-theme-accent">
            <span>Filtered by: {activeFilter.label || activeFilter.type}</span>
            <button
              type="button"
              onClick={onClearFilter}
              aria-label="Remove filter"
              className="rounded-full p-0.5 hover:bg-theme-accent/20 transition-colors"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

