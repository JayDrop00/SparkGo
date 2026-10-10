"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import TaskRow from "@/features/tasks/components/TaskRow";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import type { GroupResponseDto } from "../dto/group-response.dto";
import CompletedSection from "./CompletedSection";
import GroupHeader from "./GroupHeader";

type Props = {
  group: GroupResponseDto;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onRecolor: (color: string | null) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onAddTask: () => void;
  onEditTask: (task: TaskResponseDto) => void;
  onDeleteTask: (task: TaskResponseDto) => void;
  onToggleComplete: (task: TaskResponseDto) => void;
};

export default function GroupSection({
  group,
  collapsed,
  onToggleCollapse,
  onRename,
  onRecolor,
  onMove,
  onDelete,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group:${group.id}`, data: { type: "group" } });
  const { setNodeRef: setListRef } = useDroppable({
    id: `bucket:${group.id}`,
    data: { type: "bucket" },
  });

  return (
    <section
      ref={setNodeRef}
      data-group-id={group.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`hud-card flex w-72 shrink-0 flex-col self-start rounded-3xl sm:w-80 ${
        isDragging ? "z-20 opacity-70 shadow-[0_0_30px_rgb(0_0_0/0.6)]" : ""
      }`}
    >
      <div ref={setListRef} className="flex min-h-0 flex-1 flex-col">
        <GroupHeader
          group={group}
          collapsed={collapsed}
          dragHandleProps={{ listeners, attributes }}
          onToggleCollapse={onToggleCollapse}
          onRename={onRename}
          onRecolor={onRecolor}
          onMove={onMove}
          onDelete={onDelete}
          onAddTask={onAddTask}
        />

        {!collapsed && (
          <>
            <ul
              className="min-h-80 flex-1 space-y-2 p-3"
              aria-label={`${group.groupName} tasks`}
            >
              <SortableContext
                items={group.tasks.map((task) => `task:${task.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </SortableContext>
              {group.tasks.length === 0 && (
                <li className="rounded-2xl border border-dashed border-ink-border px-3 py-5 text-center text-xs text-slate-500">
                  Drop tasks here
                </li>
              )}
            </ul>

            <CompletedSection
              tasks={group.completedTasks}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleComplete={onToggleComplete}
            />

            <button
              type="button"
              onClick={onAddTask}
              className={`flex items-center gap-2 border-t border-ink-border/70 px-3 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:text-theme-accent ${focusRing}`}
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              Add task
            </button>
          </>
        )}
      </div>
    </section>
  );
}
