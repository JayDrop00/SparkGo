"use client";

import { useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import DropdownMenu from "@/components/ui/DropdownMenu";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { Field, Input } from "@/components/ui/Input";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import type { BoardResponseDto } from "../dto/board-response.dto";
import type { GroupResponseDto } from "../dto/group-response.dto";
import { useBoard } from "../hooks/use-board";
import { GROUP_NAME_MAX } from "../schemas/group.schema";
import GroupSection from "./GroupSection";
import UngroupedSection from "./UngroupedSection";

function findTask(board: BoardResponseDto, taskId: string): TaskResponseDto | null {
  const inUngrouped = board.ungrouped.find((task) => task.id === taskId)
    ?? board.ungroupedCompleted.find((task) => task.id === taskId);
  if (inUngrouped) return inUngrouped;
  for (const group of board.groups) {
    const task =
      group.tasks.find((item) => item.id === taskId) ??
      group.completedTasks.find((item) => item.id === taskId);
    if (task) return task;
  }
  return null;
}

function findGroup(board: BoardResponseDto, groupId: string): GroupResponseDto | null {
  return board.groups.find((group) => group.id === groupId) ?? null;
}

function previewTaskMove(
  board: BoardResponseDto,
  taskId: string,
  targetGroupId: string | null,
  beforeTaskId: string | null,
  afterTaskId: string | null,
): BoardResponseDto {
  const next: BoardResponseDto = {
    groups: board.groups.map((group) => ({
      ...group,
      tasks: [...group.tasks],
      completedTasks: [...group.completedTasks],
    })),
    ungrouped: [...board.ungrouped],
    ungroupedCompleted: [...board.ungroupedCompleted],
  };
  let movingTask: TaskResponseDto | undefined;

  const removeFrom = (tasks: TaskResponseDto[]) => {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index < 0) return;
    [movingTask] = tasks.splice(index, 1);
  };

  removeFrom(next.ungrouped);
  if (!movingTask) removeFrom(next.ungroupedCompleted);
  for (const group of next.groups) {
    if (!movingTask) removeFrom(group.tasks);
    if (!movingTask) removeFrom(group.completedTasks);
    group.taskCount = group.tasks.length + group.completedTasks.length;
  }
  if (!movingTask) return board;

  const placed = { ...movingTask, groupId: targetGroupId };
  const targetGroup = targetGroupId
    ? next.groups.find((group) => group.id === targetGroupId)
    : null;
  const targetTasks = targetGroup?.tasks ?? next.ungrouped;
  const beforeIndex = beforeTaskId
    ? targetTasks.findIndex((task) => task.id === beforeTaskId)
    : -1;
  const afterIndex = afterTaskId
    ? targetTasks.findIndex((task) => task.id === afterTaskId)
    : -1;

  if (beforeIndex >= 0) targetTasks.splice(beforeIndex, 0, placed);
  else if (afterIndex >= 0) targetTasks.splice(afterIndex + 1, 0, placed);
  else targetTasks.push(placed);
  if (targetGroup) targetGroup.taskCount = targetGroup.tasks.length + targetGroup.completedTasks.length;

  const sameOrder = (left: TaskResponseDto[], right: TaskResponseDto[]) =>
    left.length === right.length && left.every((task, index) => task.id === right[index]?.id);
  const unchanged =
    sameOrder(next.ungrouped, board.ungrouped) &&
    sameOrder(next.ungroupedCompleted, board.ungroupedCompleted) &&
    next.groups.every((group, index) =>
      sameOrder(group.tasks, board.groups[index].tasks) &&
      sameOrder(group.completedTasks, board.groups[index].completedTasks),
    );
  if (unchanged) return board;
  return next;
}

type FormState = {
  open: boolean;
  task: TaskResponseDto | null;
  groupId: string | null;
};

function boardVersion(initialBoard: BoardResponseDto): string {
  const groups = initialBoard.groups.map(({ id, groupName, color, position }) => [id, groupName, color, position]);
  const tasks = [
    ...initialBoard.ungrouped,
    ...initialBoard.ungroupedCompleted,
    ...initialBoard.groups.flatMap((group) => [...group.tasks, ...group.completedTasks]),
  ].map((task) => [
    task.id,
    task.updatedAt,
    task.taskName,
    task.groupId,
    task.startAt,
    task.endAt,
    task.dueDate,
    task.deadlineAt,
    task.completedAt,
    task.position,
  ]);
  return JSON.stringify([groups, tasks]);
}

function GroupBoardContent({ initialBoard }: { initialBoard: BoardResponseDto }) {
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
  const [dragPreview, setDragPreview] = useState<BoardResponseDto | null>(null);
  const dragPreviewRef = useRef<BoardResponseDto | null>(null);
  const updateDragPreview = (preview: BoardResponseDto | null) => {
    dragPreviewRef.current = preview;
    setDragPreview(preview);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group drags must only collide with group columns (their bucket droppables
  // fill most of a column and would otherwise win closestCorners); task drags
  // collide with task rows and buckets, never with group columns.
  // For group drags, pointerWithin flips the target as soon as the cursor
  // enters a neighboring column (~16px) instead of closestCorners' static-rect
  // midpoint threshold (~half a column width). The closestCorners fallback
  // always includes every group section so `over` stays valid mid-drag —
  // a null `over` would stop the dragged column from following the cursor.
  const collisionDetection: CollisionDetection = (args) => {
    const isGroupDrag = String(args.active.id).startsWith("group:");
    if (isGroupDrag) {
      const groups = args.droppableContainers.filter((container) =>
        String(container.id).startsWith("group:"),
      );
      if (args.pointerCoordinates) {
        const hits = pointerWithin({
          ...args,
          droppableContainers: groups.filter(
            (container) => container.id !== args.active.id,
          ),
        });
        if (hits.length) return hits;
      }
      return closestCorners({ ...args, droppableContainers: groups });
    }
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => !String(container.id).startsWith("group:"),
      ),
    });
  };

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      updateDragPreview(null);
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("group:")) {
      const activeGroupId = activeId.slice(6);
      const overGroupId = overId.startsWith("group:")
        ? overId.slice(6)
        : null;

      if (!overGroupId || overGroupId === activeGroupId) return;
      const ordered = board.board.groups.map((group) => group.id);
      const from = ordered.indexOf(activeGroupId);
      const to = ordered.indexOf(overGroupId);
      if (from < 0 || to < 0) return;
      ordered.splice(from, 1);
      ordered.splice(to, 0, activeGroupId);
      updateDragPreview(null);
      void board.applyGroupOrder(ordered);
      return;
    }

    if (!activeId.startsWith("task:")) {
      updateDragPreview(null);
      return;
    }
    const taskId = activeId.slice(5);
    if (overId === activeId) {
      const preview = dragPreviewRef.current;
      const previewTask = preview ? findTask(preview, taskId) : null;
      const previewGroupId = previewTask?.groupId ?? null;
      const previewList = previewGroupId
        ? findGroup(preview!, previewGroupId)?.tasks ?? []
        : preview?.ungrouped ?? [];
      const previewIndex = previewList.findIndex((task) => task.id === taskId);
      const originalTask = findTask(board.board, taskId);
      const originalList = originalTask?.groupId
        ? findGroup(board.board, originalTask.groupId)?.tasks ?? []
        : board.board.ungrouped;
      const originalIndex = originalList.findIndex((task) => task.id === taskId);
      updateDragPreview(null);

      if (
        previewTask &&
        (previewGroupId !== (originalTask?.groupId ?? null) || previewIndex !== originalIndex)
      ) {
        void board.moveTaskTo({
          taskId,
          targetGroupId: previewGroupId,
          beforeTaskId: previewList[previewIndex + 1]?.id ?? null,
          afterTaskId: previewList[previewIndex - 1]?.id ?? null,
        });
      }
      return;
    }

    let targetGroupId: string | null = null;
    let beforeTaskId: string | null = null;
    let afterTaskId: string | null = null;

    if (overId.startsWith("bucket:")) {
      const bucket = overId.slice(7);
      targetGroupId = bucket === "ungrouped" ? null : bucket;
    } else if (overId.startsWith("group:")) {
      targetGroupId = overId.slice(6);
      if (!findGroup(board.board, targetGroupId)) {
        updateDragPreview(null);
        return;
      }
    } else if (overId.startsWith("task:")) {
      const overTask = findTask(board.board, overId.slice(5));
      if (!overTask) {
        updateDragPreview(null);
        return;
      }
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
      updateDragPreview(null);
      return;
    }

    if (!beforeTaskId && !afterTaskId) {
      const current = findTask(board.board, taskId);
      if (current && (current.groupId ?? null) === targetGroupId) {
        updateDragPreview(null);
        return;
      }
    }

    updateDragPreview(null);
    void board.moveTaskTo({ taskId, targetGroupId, beforeTaskId, afterTaskId });
  }

  function handleDragStart({ active }: DragStartEvent) {
    if (String(active.id).startsWith("task:")) {
      updateDragPreview(board.board);
    }
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const activeId = String(active.id);
    if (!activeId.startsWith("task:") || !over || over.id === active.id) return;

    const current = dragPreviewRef.current ?? board.board;
    const taskId = activeId.slice(5);
    const overId = String(over.id);
    let targetGroupId: string | null;
    let beforeTaskId: string | null = null;
    let afterTaskId: string | null = null;

    if (overId.startsWith("bucket:")) {
      const bucketId = overId.slice(7);
      targetGroupId = bucketId === "ungrouped" ? null : bucketId;
    } else if (overId.startsWith("task:")) {
      const overTask = findTask(current, overId.slice(5));
      if (!overTask) return;
      targetGroupId = overTask.groupId;
      const list = targetGroupId
        ? findGroup(current, targetGroupId)?.tasks ?? []
        : current.ungrouped;
      const overIndex = list.findIndex((task) => task.id === overTask.id);
      const activeIndex = list.findIndex((task) => task.id === taskId);
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      const insertAfter = activeRect
        ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
        : activeIndex >= 0 && activeIndex < overIndex;
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

    const preview = previewTaskMove(current, taskId, targetGroupId, beforeTaskId, afterTaskId);
    if (preview !== current) updateDragPreview(preview);
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

  const displayedBoard = dragPreview ?? board.board;
  const groupList = displayedBoard.groups;
  const isEmpty =
    groupList.length === 0 &&
    displayedBoard.ungrouped.length === 0 &&
    displayedBoard.ungroupedCompleted.length === 0;

  const groupSortIds = useMemo(
    () => groupList.map((group) => `group:${group.id}`),
    [groupList],
  );

  return (
    <div className="min-w-0 max-w-full space-y-5">
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
        <DropdownMenu
          ariaLabel="Create"
          connected
          triggerClassName={(open) =>
            `!inline-flex !w-48 !justify-center !items-center !gap-1.5 !border-0 !bg-linear-to-br !from-theme-accent !to-theme-secondary !px-4 !py-2 !font-semibold !text-ink-base !shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] !transition-[background-color,border-color,border-radius] duration-150 hover:!text-ink-base ${
              open ? "!rounded-t-full !rounded-b-none" : "!rounded-full"
            }`
          }
          items={[
            {
              id: "group",
              label: "Create new group",
              onSelect: openGroupDialog,
            },
            {
              id: "task",
              label: "Create new task",
              dividerBefore: true,
              onSelect: () => openCreateTask(null),
            },
          ]}
        >
          <Icon name="plus" className="h-4 w-4" />
          Create
        </DropdownMenu>
      </div>

      {isEmpty ? (
        <div className="mx-auto max-w-xl space-y-4">
          <EmptyState
            icon="layers"
            title="No groups yet – create your first group"
            description="Groups are personal containers for your tasks — “This Week”, “In Review”, “Backlog”. Tasks without a group live in Ungrouped."
          />
        </div>
      ) : (
        <DndContext
          id="grouped-personal-task-board"
          sensors={sensors}
          collisionDetection={collisionDetection}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => updateDragPreview(null)}
        >
          <div className="flex max-w-full items-start gap-4 overflow-x-auto pb-6">
            <div className="sticky left-0 z-30 shrink-0 self-start rounded-3xl bg-ink-base pr-2 shadow-[8px_0_16px_-8px_rgb(0_0_0/0.6)]">
              <UngroupedSection
                tasks={displayedBoard.ungrouped}
                completedTasks={displayedBoard.ungroupedCompleted}
                onEditTask={openEditTask}
                onDeleteTask={setTaskToDelete}
                onToggleComplete={(task) =>
                  void board.setTaskCompleted(task.id, task.completedAt === null)
                }
                onAddTask={() => openCreateTask(null)}
              />
            </div>

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
                  onToggleComplete={(task) =>
                    void board.setTaskCompleted(task.id, task.completedAt === null)
                  }
                />
              ))}
            </SortableContext>
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
            {(groupToDelete?.tasks ?? [])
              .concat(groupToDelete?.completedTasks ?? [])
              .slice(0, 5)
              .map((task) => (
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
          This will be removed permanently. This cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}

export default function GroupBoard({ initialBoard }: { initialBoard: BoardResponseDto }) {
  return <GroupBoardContent key={boardVersion(initialBoard)} initialBoard={initialBoard} />;
}
