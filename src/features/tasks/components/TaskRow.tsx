"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import type { TaskResponseDto } from "../dto/task-response.dto";
import DifficultyBadge from "./DifficultyBadge";
import DueDateText from "./DueDateText";

type ContentProps = {
  task: TaskResponseDto;
  onEdit: (task: TaskResponseDto) => void;
  onDelete: (task: TaskResponseDto) => void;
  onToggleComplete: (task: TaskResponseDto) => void;
  dragHandle?: ReactNode;
};

export function TaskRowContent({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
  dragHandle,
}: ContentProps) {
  const completed = task.completedAt !== null;

  return (
    <>
      <button
        type="button"
        aria-label={
          completed
            ? `Mark "${task.taskName}" as not done`
            : `Mark "${task.taskName}" as done`
        }
        aria-pressed={completed}
        onClick={() => onToggleComplete(task)}
        className={`mt-0.5 shrink-0 rounded-full transition-colors ${focusRing} ${
          completed
            ? "text-emerald-400 hover:text-emerald-300"
            : "text-slate-500 hover:text-theme-accent"
        }`}
      >
        <Icon
          name={completed ? "checked" : "unchecked"}
          className={`h-5 w-5 ${completed ? "" : "opacity-60 hover:opacity-100"}`}
        />
      </button>

      {dragHandle}

      <button
        type="button"
        onClick={() => onEdit(task)}
        className={`min-w-0 flex-1 text-left ${focusRing} rounded-md`}
      >
        <p
          className={`truncate text-sm font-semibold transition-colors ${
            completed
              ? "text-slate-500 line-through"
              : "text-white group-hover:text-theme-accent"
          }`}
          title={task.taskName}
        >
          {task.taskName}
        </p>
        {!completed && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <DifficultyBadge difficulty={task.difficulty} />
            <DueDateText dueDate={task.dueDate} />
          </div>
        )}
      </button>

      <button
        type="button"
        aria-label={`Delete task "${task.taskName}"`}
        onClick={() => onDelete(task)}
        className={`mt-0.5 shrink-0 rounded-md p-1 text-slate-500 opacity-0 transition-all hover:bg-red-400/15 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 ${focusRing}`}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

type Props = {
  task: TaskResponseDto;
  onEdit: (task: TaskResponseDto) => void;
  onDelete: (task: TaskResponseDto) => void;
  onToggleComplete: (task: TaskResponseDto) => void;
};

export default function TaskRow({ task, onEdit, onDelete, onToggleComplete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `task:${task.id}`, data: { type: "task" } });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`group flex items-start gap-1.5 rounded-2xl border border-ink-border bg-ink-card/70 p-2.5 transition-colors hover:border-theme-accent/40 ${
        isDragging ? "opacity-60 shadow-[0_0_20px_rgb(var(--theme-rgb)/0.25)]" : ""
      }`}
    >
      <TaskRowContent
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
        dragHandle={
          <button
            type="button"
            aria-label={`Drag task "${task.taskName}"`}
            {...attributes}
            {...listeners}
            className={`mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-500 transition-colors hover:bg-ink-border hover:text-theme-accent active:cursor-grabbing ${focusRing}`}
          >
            <Icon name="grip" className="h-4 w-4" />
          </button>
        }
      />
    </li>
  );
}
