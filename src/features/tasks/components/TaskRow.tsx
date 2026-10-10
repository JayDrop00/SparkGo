"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import type { TaskResponseDto } from "../dto/task-response.dto";
import DifficultyBadge from "./DifficultyBadge";
import DueDateText from "./DueDateText";

type Props = {
  task: TaskResponseDto;
  onEdit: (task: TaskResponseDto) => void;
  onDelete: (task: TaskResponseDto) => void;
};

export default function TaskRow({ task, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `task:${task.id}` });

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
      <button
        type="button"
        aria-label={`Drag task "${task.taskName}"`}
        {...attributes}
        {...listeners}
        className={`mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-500 transition-colors hover:bg-ink-border hover:text-theme-accent active:cursor-grabbing ${focusRing}`}
      >
        <Icon name="grip" className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onEdit(task)}
        className={`min-w-0 flex-1 text-left ${focusRing} rounded-md`}
      >
        <p
          className="truncate text-sm font-semibold text-white transition-colors group-hover:text-theme-accent"
          title={task.taskName}
        >
          {task.taskName}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={task.difficulty} />
          <DueDateText dueDate={task.dueDate} />
          {task.checklist.total > 0 && (
            <Badge
              tone={task.checklist.checked === task.checklist.total ? "success" : "neutral"}
              title="Checklist progress"
            >
              <Icon
                name={task.checklist.checked === task.checklist.total ? "checked" : "unchecked"}
                className="h-3 w-3"
              />
              {task.checklist.checked}/{task.checklist.total}
            </Badge>
          )}
        </div>
      </button>

      <button
        type="button"
        aria-label={`Delete task "${task.taskName}"`}
        onClick={() => onDelete(task)}
        className={`mt-0.5 shrink-0 rounded-md p-1 text-slate-500 opacity-0 transition-all hover:bg-red-400/15 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 ${focusRing}`}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
