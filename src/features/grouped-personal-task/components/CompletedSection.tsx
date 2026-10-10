"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import { TaskRowContent } from "@/features/tasks/components/TaskRow";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";

type Props = {
  tasks: TaskResponseDto[];
  onEditTask: (task: TaskResponseDto) => void;
  onDeleteTask: (task: TaskResponseDto) => void;
  onToggleComplete: (task: TaskResponseDto) => void;
};

export default function CompletedSection({
  tasks,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
}: Props) {
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-ink-border/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:text-theme-accent ${focusRing}`}
      >
        <Icon name={open ? "chevronDown" : "chevronRight"} className="h-3.5 w-3.5" />
        Completed
        <span className="ml-auto rounded-full border border-ink-border bg-ink-card/70 px-2 py-0.5 font-data text-[11px] text-slate-400">
          {tasks.length}
        </span>
      </button>

      {open && (
        <ul className="space-y-2 px-3 pb-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="group flex items-start gap-1.5 rounded-2xl border border-ink-border/60 bg-ink-card/40 p-2.5"
            >
              <TaskRowContent
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleComplete={onToggleComplete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
