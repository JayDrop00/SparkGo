"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Icon from "@/components/ui/Icon";
import TaskRow from "@/features/tasks/components/TaskRow";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import CompletedSection from "./CompletedSection";

type Props = {
  tasks: TaskResponseDto[];
  completedTasks: TaskResponseDto[];
  onEditTask: (task: TaskResponseDto) => void;
  onDeleteTask: (task: TaskResponseDto) => void;
  onToggleComplete: (task: TaskResponseDto) => void;
  onAddTask: () => void;
};

export default function UngroupedSection({
  tasks,
  completedTasks,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
  onAddTask,
}: Props) {
  const { setNodeRef } = useDroppable({
    id: "bucket:ungrouped",
    data: { type: "bucket" },
  });

  return (
    <section
      ref={setNodeRef}
      className="flex w-72 shrink-0 flex-col self-start rounded-3xl border border-dashed border-ink-border bg-ink-surface/50 sm:w-80"
    >
      <header className="flex items-center gap-2 border-b border-ink-border/70 p-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-border bg-ink-card text-slate-400">
          <Icon name="folder" className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-bold text-slate-300">Ungrouped</h3>
        <span className="rounded-full border border-ink-border bg-ink-card/70 px-2 py-0.5 font-data text-[11px] text-slate-400">
          {tasks.length + completedTasks.length}
        </span>
      </header>

      <ul
        className="min-h-80 flex-1 space-y-2 p-3"
        aria-label="Ungrouped tasks"
      >
        <SortableContext
          items={tasks.map((task) => `task:${task.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-ink-border px-3 py-5 text-center text-xs text-slate-500">
            Drop tasks here
          </li>
        )}
      </ul>

      <CompletedSection
        tasks={completedTasks}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        onToggleComplete={onToggleComplete}
      />

      <button
        type="button"
        onClick={onAddTask}
        className="flex items-center gap-2 border-t border-ink-border/70 px-3 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:text-theme-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        Add task
      </button>
    </section>
  );
}
