"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TeamTaskDto, TeamTaskGroupDto, TeamTaskMemberDto } from "../dto/team-task.dto";
import TeamTaskCard from "./TeamTaskCard";
import TeamTaskEmptyColumn from "./TeamTaskEmptyColumn";

type TaskView = "active" | "completed" | "archived";

export default function TeamTaskColumn({
  group,
  tasks,
  allTasks,
  now,
  view,
  members,
  canManage,
  collapsed,
  glowingTaskId,
  onToggleCollapse,
  onDeleteGroup,
  onOpenTask,
  onStartTask,
  onCompleteTask,
  onAddTaskToGroup,
}: {
  group: TeamTaskGroupDto | null;
  tasks: TeamTaskDto[];
  allTasks: TeamTaskDto[];
  now: number;
  view: TaskView;
  members: TeamTaskMemberDto[];
  canManage: boolean;
  collapsed: boolean;
  glowingTaskId: string | null;
  onToggleCollapse: () => void;
  onDeleteGroup: (group: TeamTaskGroupDto) => void;
  onOpenTask: (task: TeamTaskDto) => void;
  onStartTask: (task: TeamTaskDto) => void;
  onCompleteTask: (task: TeamTaskDto) => void;
  onAddTaskToGroup: (groupId: string | null) => void;
}) {
  const id = group?.id ?? null;
  const isPinnedUngrouped = group === null;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging: isGroupDragging,
    isOver: isGroupOver,
  } = useSortable({
    id: `group:${group?.id ?? "ungrouped"}`,
    disabled: !group || !canManage,
    data: { kind: "group", groupId: id },
  });

  const { setNodeRef: setBucketNodeRef, isOver: isBucketOver } = useDroppable({
    id: `bucket:${id ?? "ungrouped"}`,
    data: { kind: "bucket", groupId: id },
  });

  const isDropTarget = isBucketOver || isGroupOver;

  // Calculate completion progress
  const allGroupTasks = allTasks.filter(
    (t) => t.groupId === id && !t.archivedAt,
  );
  const completedCount = allGroupTasks.filter((t) => t.status === "done").length;
  const progress = allGroupTasks.length
    ? Math.round((completedCount / allGroupTasks.length) * 100)
    : 0;

  const canDragTasks = canManage && view !== "archived";

  const groupColor = group?.color ?? "var(--theme-accent)";

  return (
    <section
      id={`col-${id ?? "ungrouped"}`}
      ref={group ? setSortableNodeRef : undefined}
      style={group ? { transform: CSS.Transform.toString(transform), transition } : undefined}
      className={`flex w-[85vw] sm:w-[295px] min-w-[85vw] sm:min-w-[295px] max-w-[85vw] sm:max-w-[295px] shrink-0 snap-center flex-col ${
        isGroupDragging ? "opacity-30" : ""
      } ${
        isPinnedUngrouped
          ? "sticky left-0 z-20 rounded-2xl bg-ink-base/95 pr-2 backdrop-blur-md shadow-[10px_0_20px_-10px_rgba(0,0,0,0.7)]"
          : ""
      }`}
    >
      {/* COLUMN HEADER sits ABOVE the column container */}
      <div className="group/col-header mb-2.5 flex items-center justify-between gap-1 px-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* Column Drag Handle (visible on hover) */}
          {canManage && group && (
            <button
              type="button"
              aria-label={`Reorder column ${group.name}`}
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none rounded p-0.5 text-slate-500 opacity-60 sm:opacity-0 group-hover/col-header:opacity-100 hover:bg-ink-border hover:text-slate-200 active:cursor-grabbing transition-opacity focus:opacity-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="9" cy="6" r="1.2" fill="currentColor" />
                <circle cx="9" cy="12" r="1.2" fill="currentColor" />
                <circle cx="9" cy="18" r="1.2" fill="currentColor" />
                <circle cx="15" cy="6" r="1.2" fill="currentColor" />
                <circle cx="15" cy="12" r="1.2" fill="currentColor" />
                <circle cx="15" cy="18" r="1.2" fill="currentColor" />
              </svg>
            </button>
          )}

          {/* Colored status dot 8px */}
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: groupColor }}
          />

          {/* Group name */}
          <h2 className="truncate font-display text-base font-bold text-white tracking-tight">
            {isPinnedUngrouped ? "Ungrouped" : group.name}
          </h2>

          {/* Count in muted parentheses */}
          <span className="shrink-0 text-xs font-normal text-slate-500">
            ({tasks.length})
          </span>

          {/* Pinned pill for ungrouped */}
          {isPinnedUngrouped && (
            <span className="shrink-0 rounded border border-theme-accent/25 bg-theme-accent/10 px-1.5 py-0.5 font-data text-[9px] font-bold uppercase tracking-wider text-theme-accent">
              PINNED
            </span>
          )}
        </div>

        {/* Right side actions: collapse chevron, + add task button, delete icon (on hover) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Collapse chevron */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand column" : "Collapse column"}
            title={collapsed ? "Expand column" : "Collapse column"}
            className="rounded p-1 text-slate-500 hover:bg-ink-border hover:text-white transition-colors"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* + Add task icon button */}
          {canManage && (
            <button
              type="button"
              onClick={() => onAddTaskToGroup(id)}
              aria-label={`Add task to ${isPinnedUngrouped ? "Ungrouped" : group.name}`}
              title="Add task to this column"
              className="rounded p-1 text-slate-500 hover:bg-ink-border hover:text-theme-accent transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          {/* Delete group icon button (visible on hover) */}
          {canManage && group && (
            <button
              type="button"
              onClick={() => onDeleteGroup(group)}
              aria-label={`Delete group ${group.name}`}
              title="Delete group (keeps tasks in Ungrouped)"
              className="rounded p-1 text-slate-500 opacity-0 group-hover/col-header:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 transition-all focus:opacity-100"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Thin progress line and "0/0 completed · 0%" as small muted text under the header */}
      <div className="mb-2 px-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{view === "active" ? `${tasks.length} active` : `${tasks.length} shown`}</span>
          <span>
            {completedCount}/{allGroupTasks.length} completed · {progress}%
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-border/70">
          <div
            className="h-full rounded-full bg-linear-to-br from-theme-accent to-theme-secondary transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* COLUMN CONTAINER */}
      {!collapsed && (
        <div
          ref={setBucketNodeRef}
          className={`flex min-h-[220px] max-h-[calc(100vh-270px)] flex-col rounded-2xl border p-3 sm:p-3.5 transition-colors kanban-col-scroll overflow-y-auto ${
            isPinnedUngrouped ? "border-t-2 border-t-theme-accent/70" : ""
          } ${
            isDropTarget
              ? "border-dashed border-theme-accent/80 bg-theme-accent/5"
              : "border-ink-border bg-ink-surface/60"
          }`}
        >
          <SortableContext
            items={tasks.map((task) => `task:${task.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {tasks.map((task) => (
                <TeamTaskCard
                  key={task.id}
                  task={task}
                  now={now}
                  members={members}
                  canManage={canManage}
                  draggable={canDragTasks}
                  glowing={glowingTaskId === task.id}
                  onOpen={() => onOpenTask(task)}
                  onStart={() => onStartTask(task)}
                  onComplete={() => onCompleteTask(task)}
                />
              ))}

              {tasks.length === 0 && (
                <TeamTaskEmptyColumn
                  color={group?.color}
                  onAddTask={() => onAddTaskToGroup(id)}
                />
              )}
            </div>
          </SortableContext>
        </div>
      )}
    </section>
  );
}
