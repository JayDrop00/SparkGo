"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TeamTaskDto, TeamTaskMemberDto } from "../dto/team-task.dto";

const PRIORITY_MAP: Record<string, { label: string; bg: string; text: string }> = {
  VERY_HARD: { label: "urgent", bg: "#e11d48", text: "#ffffff" },
  HARD: { label: "high", bg: "#f97316", text: "#ffffff" },
  MEDIUM: { label: "medium", bg: "#eab308", text: "#0f172a" },
  EASY: { label: "low", bg: "#64748b", text: "#ffffff" },
};

function initials(name: string | null, fallback: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length
    ? parts
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : fallback.slice(0, 2).toUpperCase();
}

function formatCardDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function TeamTaskCard({
  task,
  now,
  members,
  canManage,
  draggable,
  glowing,
  onOpen,
  onStart,
  onComplete,
}: {
  task: TeamTaskDto;
  now: number;
  members: TeamTaskMemberDto[];
  canManage: boolean;
  draggable: boolean;
  glowing: boolean;
  onOpen: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task:${task.id}`,
    disabled: !draggable,
    data: { kind: "task", taskId: task.id },
  });

  const openRequests = task.helpRequests.filter((r) => r.status === "open");
  const isOverdue = Boolean(
    task.dueAt &&
      task.status !== "done" &&
      !task.archivedAt &&
      new Date(task.dueAt).getTime() < now,
  );
  const priority = PRIORITY_MAP[task.difficulty] ?? PRIORITY_MAP.MEDIUM;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="min-h-[120px] rounded-xl border border-dashed border-theme-accent/50 bg-theme-accent/5 p-3.5 opacity-60"
        aria-hidden="true"
      />
    );
  }

  const assignedMembers = task.assigneeIds
    .map((id) => members.find((m) => m.id === id) || { id, name: null, avatarUrl: null })
    .slice(0, 3);
  const remainingCount = task.assigneeIds.length - assignedMembers.length;

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.name}`}
      className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left cursor-pointer select-none outline-none transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent ${
        glowing
          ? "animate-[pulse_1.4s_ease-in-out_2] border-theme-accent shadow-[0_0_24px_rgb(var(--theme-rgb)/0.35)]"
          : "border-ink-border bg-ink-card hover:-translate-y-0.5 hover:border-theme-accent/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      }`}
    >
      <div>
        {/* ROW 1: Status badge + Priority solid pill + Optional AI/Epic badge + Complete check */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status icon badge 22px, rounded 6px */}
            {task.status === "done" ? (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-emerald-500/15 text-emerald-400"
                title="Completed"
                aria-label="Status: Completed"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            ) : task.status === "in_progress" ? (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-blue-500/15 text-blue-400"
                title="In Progress"
                aria-label="Status: In Progress"
              >
                <svg className="h-3 w-3 animate-spin duration-3000" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
            ) : (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-slate-500/15 text-slate-400"
                title="To do"
                aria-label="Status: To do"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
            )}

            {/* Solid priority pill (6px radius, 11px, 600 weight, lowercase) */}
            <span
              className="rounded-[6px] px-2 py-0.5 text-[11px] font-semibold lowercase tracking-wide"
              style={{
                backgroundColor: priority.bg,
                color: priority.text,
              }}
            >
              {priority.label}
            </span>

            {/* Optional AI/Epic badge */}
            {openRequests.length > 0 && (
              <span
                className="rounded-md bg-linear-to-br from-theme-accent to-theme-secondary px-1.5 py-0.5 text-[10px] font-bold text-ink-base shadow-xs"
                title={`${openRequests.length} active help request(s)`}
              >
                Help
              </span>
            )}

            {task.latestRequest?.status === "pending" && (
              <span
                className="rounded-md bg-linear-to-br from-theme-accent to-theme-secondary px-1.5 py-0.5 text-[10px] font-bold text-ink-base shadow-xs"
                title="Completion review requested"
              >
                Review
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Quick complete button for managers */}
            {canManage && task.status !== "done" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                className="rounded-md p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/15 hover:text-emerald-300 transition-all focus:opacity-100"
                title="Mark completed"
                aria-label={`Mark ${task.name} completed`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}

            {/* Drag Handle button */}
            {draggable && (
              <button
                type="button"
                aria-label={`Drag task ${task.name}`}
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab touch-none rounded p-1 text-slate-500 opacity-60 sm:opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-slate-200 active:cursor-grabbing transition-opacity focus:opacity-100"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="9" cy="6" r="1.2" fill="currentColor" />
                  <circle cx="9" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="9" cy="18" r="1.2" fill="currentColor" />
                  <circle cx="15" cy="6" r="1.2" fill="currentColor" />
                  <circle cx="15" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="15" cy="18" r="1.2" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: Title */}
        <h3 className="mt-2 text-[15px] font-semibold text-white leading-snug line-clamp-2 break-words">
          {task.name}
        </h3>

        {/* ROW 3: Description */}
        {task.description && (
          <p className="mt-1 text-[13px] text-slate-500 line-clamp-1 break-words">
            {task.description}
          </p>
        )}

        {/* ROW 4: Tag chips */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {task.assigneeIds.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-ink-border bg-ink-surface px-2 py-0.5 text-[12px] text-slate-400">
              <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {task.assigneeIds.length === 1
                ? assignedMembers[0]?.name?.split(" ")[0] || "1 assigned"
                : `${task.assigneeIds.length} assigned`}
            </span>
          )}

          {openRequests.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[12px] text-rose-300">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Blocked
            </span>
          )}
        </div>
      </div>

        {/* FOOTER ROW: [assignee avatar 22px] [due date] ...... [icons in accent] */}
      <div>
        <div className="mt-3 flex items-center justify-between border-t border-ink-border pt-2.5">
          {/* Left: Assignee avatar(s) & Due Date */}
          <div className="flex items-center gap-2 min-w-0">
            {assignedMembers.length > 0 ? (
              <div className="flex items-center -space-x-1.5 shrink-0">
                {assignedMembers.map((member) => (
                  <span
                    key={member.id}
                    title={member.name || `Member ${member.id.slice(0, 6)}`}
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-ink-border bg-ink-border text-[9px] font-bold text-white shadow-xs"
                  >
                    {initials(member.name, member.id)}
                  </span>
                ))}
                {remainingCount > 0 && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-ink-border bg-ink-input px-1 text-[9px] font-bold text-slate-300">
                    +{remainingCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">Unassigned</span>
            )}

            {task.dueAt && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] truncate ${
                  isOverdue ? "font-semibold text-rose-400" : "text-slate-400"
                }`}
                title={isOverdue ? "Overdue task" : `Due ${formatCardDate(task.dueAt)}`}
              >
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {isOverdue ? "Overdue " : ""}
                {formatCardDate(task.dueAt)}
              </span>
            )}
          </div>

          {/* Right: small link/comment/help icons in accent */}
          <div className="flex items-center gap-1.5 text-theme-accent shrink-0">
            {openRequests.length > 0 && (
              <span title={`${openRequests.length} active help request(s)`} className="flex items-center gap-0.5 text-xs">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-[10px] font-bold">{openRequests.length}</span>
              </span>
            )}

            {task.description && (
              <span title="Task description available" className="text-slate-500">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Start button: full-width ghost button at bottom of card */}
        {task.status === "todo" && task.assigneeIds.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            className="mt-2.5 w-full rounded-lg border border-ink-border bg-transparent py-1.5 text-xs font-semibold text-theme-accent transition-all hover:border-theme-accent/40 hover:bg-theme-accent/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          >
            Start work
          </button>
        )}
      </div>
    </article>
  );
}

