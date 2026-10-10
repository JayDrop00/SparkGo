"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { Field, Input } from "@/components/ui/Input";
import { focusRing } from "@/components/ui/styles";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import type { BoardResponseDto } from "../dto/board-response.dto";
import type { GroupResponseDto } from "../dto/group-response.dto";
import { useBoard } from "../hooks/use-board";
import { GROUP_NAME_MAX } from "../schemas/group.schema";
import GroupSection from "./GroupSection";
import UngroupedSection from "./UngroupedSection";

function findTask(board: BoardResponseDto, taskId: string): TaskResponseDto | null {
  const inUngrouped = board.ungrouped.find((task) => task.id === taskId);
  if (inUngrouped) return inUngrouped;
  for (const group of board.groups) {
    const task = group.tasks.find((item) => item.id === taskId);
    if (task) return task;
  }
  return null;
}

function findGroup(board: BoardResponseDto, groupId: string): GroupResponseDto | null {
  return board.groups.find((group) => group.id === groupId) ?? null;
}

type FormState = {
  open: boolean;
  task: TaskResponseDto | null;
  groupId: string | null;
};

export default function GroupBoard({ initialBoard }: { initialBoard: BoardResponseDto }) {
  const board = useBoard(initialBoard);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    task: null,
    groupId: null,
  });
  const [groupToDelete, setGroupToDelete] = useState<GroupResponseDto | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskResponseDto | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const describe = (id: string): string => {
    if (id.startsWith("task:")) {
      const task = findTask(board.board, id.slice(5));
      return task ? `task ${task.taskName}` : "task";
    }
    if (id.startsWith("group:")) {
      const group = findGroup(board.board, id.slice(6));
      return group ? `group ${group.groupName}` : "group";
    }
    if (id.startsWith("bucket:")) {
      return id.slice(7) === "ungrouped" ? "Ungrouped" : "a group";
    }
    return "item";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(String(active.id))}.`,
    onDragOver: ({ over }) =>
      over
        ? `Now over ${describe(String(over.id))}.`
        : `No longer over a droppable area.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Placed ${describe(String(active.id))} in ${describe(String(over.id))}.`
        : `${describe(String(active.id))} was dropped outside a droppable area.`,
    onDragCancel: ({ active }) =>
      `Dragging was cancelled. ${describe(String(active.id))} returned to its original position.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("group:")) {
      if (!overId.startsWith("group:")) return;
      const activeGroupId = activeId.slice(6);
      const overGroupId = overId.slice(6);
      if (activeGroupId === overGroupId) return;
      const ordered = board.board.groups.map((group) => group.id);
      const from = ordered.indexOf(activeGroupId);
      const to = ordered.indexOf(overGroupId);
      if (from < 0 || to < 0) return;
      ordered.splice(from, 1);
      ordered.splice(to, 0, activeGroupId);
      void board.applyGroupOrder(ordered);
      return;
    }

    if (!activeId.startsWith("task:")) return;
    const taskId = activeId.slice(5);
    if (taskId === overId.slice(5)) return;

    let targetGroupId: string | null = null;
    let beforeTaskId: string | null = null;
    let afterTaskId: string | null = null;

    if (overId.startsWith("bucket:")) {
      const bucket = overId.slice(7);
      targetGroupId = bucket === "ungrouped" ? null : bucket;
    } else if (overId.startsWith("group:")) {
      targetGroupId = overId.slice(6);
      if (!findGroup(board.board, targetGroupId)) return;
    } else if (overId.startsWith("task:")) {
      const overTask = findTask(board.board, overId.slice(5));
      if (!overTask) return;
      targetGroupId = overTask.groupId;
      const list = targetGroupId
        ? (findGroup(board.board, targetGroupId)?.tasks ?? [])
        : board.board.ungrouped;

      const overIndex = list.findIndex((task) => task.id === overTask.id);
      const activeIndex = list.findIndex((task) => task.id === taskId);

      let insertAfter: boolean;
      if (activeIndex >= 0) {
        insertAfter = activeIndex < overIndex;
      } else {
        const activeRect = active.rect.current.translated ?? active.rect.current.initial;
        const overRect = over.rect;
        insertAfter = activeRect
          ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
          : false;
      }

      const rest = list.filter((task) => task.id !== taskId);
      const overAfterRemoval = rest.findIndex((task) => task.id === overTask.id);
      if (overAfterRemoval >= 0) {
        if (insertAfter) {
          afterTaskId = overTask.id;
          beforeTaskId = rest[overAfterRemoval + 1]?.id ?? null;
        } else {
          beforeTaskId = overTask.id;
          afterTaskId = rest[overAfterRemoval - 1]?.id ?? null;
        }
      }
    } else {
      return;
    }

    void board.moveTaskTo({ taskId, targetGroupId, beforeTaskId, afterTaskId });
  }

  const openCreateTask = (groupId: string | null) =>
    setFormState({ open: true, task: null, groupId });
  const openEditTask = (task: TaskResponseDto) =>
    setFormState({ open: true, task, groupId: task.groupId });

  const openGroupDialog = () => {
    setNewGroupName("");
    setGroupDialogOpen(true);
  };
  const submitGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    void board.createGroup(name);
    setGroupDialogOpen(false);
    setNewGroupName("");
  };

  const groupList = board.board.groups;
  const isEmpty = groupList.length === 0 && board.board.ungrouped.length === 0;

  const groupSortIds = useMemo(
    () => groupList.map((group) => `group:${group.id}`),
    [groupList],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-extrabold tracking-wide text-white">
            My Task
          </h2>
          {board.pending && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-accent/40 bg-theme-accent/10 px-2.5 py-0.5 font-data text-[11px] text-theme-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-theme-accent" />
              syncing
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => openCreateTask(null)}>
          <Icon name="plus" className="h-4 w-4" />
          New task
        </Button>
      </div>

      {isEmpty ? (
        <div className="mx-auto max-w-xl space-y-4">
          <EmptyState
            icon="layers"
            title="No groups yet – create your first group"
            description="Groups are personal containers for your tasks — “This Week”, “In Review”, “Backlog”. Tasks without a group live in Ungrouped."
            action={
              <Button size="sm" onClick={openGroupDialog}>
                <Icon name="plus" className="h-4 w-4" />
                Create your first group
              </Button>
            }
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{ announcements }}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-6">
            <UngroupedSection
              tasks={board.board.ungrouped}
              onEditTask={openEditTask}
              onDeleteTask={setTaskToDelete}
              onAddTask={() => openCreateTask(null)}
            />

            <SortableContext
              items={groupSortIds}
              strategy={horizontalListSortingStrategy}
            >
              {groupList.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  collapsed={board.collapsed.has(group.id)}
                  onToggleCollapse={() => board.toggleCollapse(group.id)}
                  onRename={(name) => void board.renameGroup(group.id, name)}
                  onRecolor={(color) => void board.recolorGroup(group.id, color)}
                  onMove={(delta) => void board.moveGroupBy(group.id, delta)}
                  onDelete={() => setGroupToDelete(group)}
                  onAddTask={() => openCreateTask(group.id)}
                  onEditTask={openEditTask}
                  onDeleteTask={setTaskToDelete}
                />
              ))}
            </SortableContext>

            <button
              type="button"
              onClick={openGroupDialog}
              className={`flex w-44 shrink-0 flex-col items-center justify-center gap-2 self-start rounded-3xl border border-dashed border-ink-border bg-ink-surface/40 py-10 text-slate-400 transition-colors hover:border-theme-accent/50 hover:text-theme-accent ${focusRing}`}
            >
              <Icon name="plus" className="h-5 w-5" />
              <span className="text-xs font-semibold">New group</span>
            </button>
          </div>
        </DndContext>
      )}

      <TaskFormDialog
        open={formState.open}
        onClose={() => setFormState({ open: false, task: null, groupId: null })}
        groups={groupList.map((group) => ({
          id: group.id,
          groupName: group.groupName,
        }))}
        task={formState.task}
        defaultGroupId={formState.groupId}
        onSaved={board.upsertTask}
      />

      <Dialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        title="New group"
        description="Groups are personal containers — “This Week”, “In Review”, “Backlog”…"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setGroupDialogOpen(false)}
              disabled={board.pending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitGroup}
              loading={board.pending}
              disabled={!newGroupName.trim()}
            >
              Create group
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitGroup();
          }}
        >
          <Field label="Group name" hint={`${newGroupName.length}/${GROUP_NAME_MAX}`}>
            <Input
              value={newGroupName}
              maxLength={GROUP_NAME_MAX}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="e.g. This Week"
              autoFocus
            />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={groupToDelete !== null}
        onClose={() => setGroupToDelete(null)}
        title={`Delete "${groupToDelete?.groupName ?? ""}"?`}
        description="Choose what should happen to the tasks in this group. Nothing is deleted silently."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setGroupToDelete(null)}
              disabled={board.pending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={board.pending}
              onClick={() => {
                if (!groupToDelete) return;
                void board.deleteGroupWith(groupToDelete.id, "delete");
                setGroupToDelete(null);
              }}
            >
              Delete tasks too
            </Button>
            <Button
              variant="secondary"
              loading={board.pending}
              onClick={() => {
                if (!groupToDelete) return;
                void board.deleteGroupWith(groupToDelete.id, "ungroup");
                setGroupToDelete(null);
              }}
            >
              Move to Ungrouped
            </Button>
          </>
        }
      >
        <div className="rounded-2xl border border-ink-border bg-ink-input/70 p-4 text-sm text-slate-300">
          <p>
            This group holds{" "}
            <span className="font-semibold text-white">
              {groupToDelete?.taskCount ?? 0}
            </span>{" "}
            task{groupToDelete?.taskCount === 1 ? "" : "s"}.
          </p>
          <ul className="mt-3 space-y-1.5">
            {(groupToDelete?.tasks ?? []).slice(0, 5).map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs text-slate-400">
                <Icon name="checked" className="h-3.5 w-3.5 shrink-0 text-theme-accent" />
                <span className="truncate" title={task.taskName}>
                  {task.taskName}
                </span>
              </li>
            ))}
            {(groupToDelete?.taskCount ?? 0) > 5 && (
              <li className="font-data text-[11px] text-slate-500">
                +{(groupToDelete!.taskCount - 5)} more…
              </li>
            )}
          </ul>
        </div>
      </Dialog>

      <Dialog
        open={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        title="Delete task?"
        description={`"${taskToDelete?.taskName ?? ""}" will be removed permanently.`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setTaskToDelete(null)}
              disabled={board.pending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={board.pending}
              onClick={() => {
                if (!taskToDelete) return;
                void board.deleteTask(taskToDelete.id);
                setTaskToDelete(null);
              }}
            >
              Delete task
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          Its content blocks and checklist will be deleted too. This cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}
