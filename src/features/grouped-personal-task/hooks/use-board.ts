"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/types/action-result";
import * as taskActions from "@/features/tasks/actions/task.actions";
import type { MoveTaskDto } from "@/features/tasks/dto/move-task.dto";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import * as groupActions from "../actions/group.actions";
import type { BoardResponseDto } from "../dto/board-response.dto";

export type BoardState = BoardResponseDto;

type MutationOptions<T> = {
  optimistic?: (prev: BoardState) => BoardState;
  onSuccess?: (data: T) => void;
  successMessage?: string;
};

function cloneBoard(state: BoardState): BoardState {
  return {
    groups: state.groups.map((group) => ({
      ...group,
      tasks: [...group.tasks],
      completedTasks: [...group.completedTasks],
    })),
    ungrouped: [...state.ungrouped],
    ungroupedCompleted: [...state.ungroupedCompleted],
  };
}

function removeTask(
  state: BoardState,
  taskId: string,
): { board: BoardState; task: TaskResponseDto } | null {
  const next = cloneBoard(state);
  const ungroupedIndex = next.ungrouped.findIndex((task) => task.id === taskId);
  if (ungroupedIndex >= 0) {
    const [task] = next.ungrouped.splice(ungroupedIndex, 1);
    return { board: next, task };
  }
  const completedIndex = next.ungroupedCompleted.findIndex(
    (task) => task.id === taskId,
  );
  if (completedIndex >= 0) {
    const [task] = next.ungroupedCompleted.splice(completedIndex, 1);
    return { board: next, task };
  }
  for (const group of next.groups) {
    const index = group.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) {
      const [task] = group.tasks.splice(index, 1);
      group.taskCount = group.tasks.length + group.completedTasks.length;
      return { board: next, task };
    }
    const completedTaskIndex = group.completedTasks.findIndex(
      (task) => task.id === taskId,
    );
    if (completedTaskIndex >= 0) {
      const [task] = group.completedTasks.splice(completedTaskIndex, 1);
      group.taskCount = group.tasks.length + group.completedTasks.length;
      return { board: next, task };
    }
  }
  return null;
}

function insertTask(
  state: BoardState,
  task: TaskResponseDto,
  groupId: string | null,
  beforeTaskId?: string | null,
  afterTaskId?: string | null,
  anchorless: "append" | "position" = "append",
): BoardState {
  const next = state;
  const placed: TaskResponseDto = { ...task, groupId };
  const completed = placed.completedAt !== null;

  const targetLists = (id: string | null): {
    active: TaskResponseDto[];
    completed: TaskResponseDto[];
    bumpCount?: () => void;
  } => {
    if (!id) return { active: next.ungrouped, completed: next.ungroupedCompleted };
    const group = next.groups.find((item) => item.id === id);
    if (!group) return { active: next.ungrouped, completed: next.ungroupedCompleted };
    return {
      active: group.tasks,
      completed: group.completedTasks,
      bumpCount: () => {
        group.taskCount = group.tasks.length + group.completedTasks.length;
      },
    };
  };

  const target = targetLists(groupId);

  if (completed) {
    target.completed.unshift(placed);
    target.completed.sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    );
  } else {
    place(target.active, placed, beforeTaskId, afterTaskId, anchorless);
  }
  target.bumpCount?.();
  return next;
}

function place(
  list: TaskResponseDto[],
  task: TaskResponseDto,
  beforeTaskId?: string | null,
  afterTaskId?: string | null,
  anchorless: "append" | "position" = "append",
) {
  if (beforeTaskId) {
    const index = list.findIndex((item) => item.id === beforeTaskId);
    if (index >= 0) {
      list.splice(index, 0, task);
      return;
    }
  }
  if (afterTaskId) {
    const index = list.findIndex((item) => item.id === afterTaskId);
    if (index >= 0) {
      list.splice(index + 1, 0, task);
      return;
    }
  }
  if (anchorless === "position") {
    const index = list.findIndex((item) => item.position > task.position);
    if (index >= 0) {
      list.splice(index, 0, task);
      return;
    }
  }
  list.push(task);
}

export function useBoard(initialBoard: BoardState) {
  const router = useRouter();
  const toast = useToast();
  const [board, setBoardState] = useState<BoardState>(initialBoard);
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const boardRef = useRef(initialBoard);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const write = useCallback((next: BoardState) => {
    boardRef.current = next;
    setBoardState(next);
  }, []);

  const resync = useCallback(async () => {
    const result = await groupActions.getBoardAction();
    if (result.ok) write(result.data);
  }, [write]);

  const fail = useCallback(
    async (message: string, code?: string) => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      if (!data?.claims || code === "UNAUTHENTICATED") {
        toast.error("Your session has expired — please log in again.");
        router.replace("/auth?mode=login&next=/tasks");
        router.refresh();
        return;
      }
      toast.error(message);
    },
    [router, toast],
  );

  const mutate = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      options: MutationOptions<T> = {},
    ) => {
      const run = async () => {
        const snapshot = boardRef.current;
        if (options.optimistic) write(options.optimistic(snapshot));
        setPending(true);
        try {
          const result = await action();
          if (result.ok) {
            options.onSuccess?.(result.data);
            if (options.successMessage) toast.success(options.successMessage);
          } else {
            write(snapshot);
            if (result.error.code === "NOT_FOUND") await resync();
            await fail(result.error.message, result.error.code);
          }
        } catch {
          write(snapshot);
          await fail("Network error — your changes were restored.");
        } finally {
          setPending(false);
        }
      };
      queueRef.current = queueRef.current.then(run, run);
      return queueRef.current;
    },
    [fail, resync, toast, write],
  );

  const upsertTask = useCallback(
    (task: TaskResponseDto) => {
      const run = () => {
        const snapshot = boardRef.current;
        const removed = removeTask(snapshot, task.id);
        const base = removed ? removed.board : cloneBoard(snapshot);
        write(insertTask(base, task, task.groupId, null, null, "position"));
      };
      queueRef.current = queueRef.current.then(run, run);
    },
    [write],
  );

  const removeTaskById = useCallback(
    (taskId: string) => {
      const removed = removeTask(boardRef.current, taskId);
      if (removed) write(removed.board);
    },
    [write],
  );

  const createGroup = useCallback(
    (groupName: string, color?: string | null) =>
      mutate(() => groupActions.createGroupAction({ groupName, color }), {
        successMessage: "Group created.",
        onSuccess: (group) => {
          const next = cloneBoard(boardRef.current);
          next.groups.push({ ...group, tasks: [], taskCount: 0 });
          write(next);
        },
      }),
    [mutate, write],
  );

  const renameGroup = useCallback(
    (groupId: string, groupName: string) =>
      mutate(() => groupActions.updateGroupAction({ groupId, groupName }), {
        successMessage: "Group renamed.",
        optimistic: (prev) => {
          const next = cloneBoard(prev);
          const group = next.groups.find((item) => item.id === groupId);
          if (group) group.groupName = groupName;
          return next;
        },
      }),
    [mutate],
  );

  const recolorGroup = useCallback(
    (groupId: string, color: string | null) =>
      mutate(() => groupActions.updateGroupAction({ groupId, color }), {
        optimistic: (prev) => {
          const next = cloneBoard(prev);
          const group = next.groups.find((item) => item.id === groupId);
          if (group) group.color = color;
          return next;
        },
      }),
    [mutate],
  );

  const applyGroupOrder = useCallback(
    (orderedIds: string[]) =>
      mutate(() => groupActions.reorderGroupsAction({ orderedIds }), {
        optimistic: (prev) => {
          const next = cloneBoard(prev);
          next.groups.sort(
            (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id),
          );
          return next;
        },
      }),
    [mutate],
  );

  const moveGroupBy = useCallback(
    (groupId: string, delta: -1 | 1) => {
      const current = boardRef.current.groups.map((group) => group.id);
      const index = current.indexOf(groupId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return;
      const ordered = [...current];
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return applyGroupOrder(ordered);
    },
    [applyGroupOrder],
  );

  const deleteGroupWith = useCallback(
    (groupId: string, taskAction: "ungroup" | "delete") =>
      mutate(() => groupActions.deleteGroupAction({ groupId, taskAction }), {
        successMessage:
          taskAction === "delete"
            ? "Group and tasks deleted."
            : "Group deleted — tasks moved to Ungrouped.",
        optimistic: (prev) => {
          const next = cloneBoard(prev);
          const index = next.groups.findIndex((group) => group.id === groupId);
          if (index < 0) return prev;
          const [group] = next.groups.splice(index, 1);
          if (taskAction === "ungroup") {
            next.ungrouped.push(
              ...group.tasks.map((task) => ({ ...task, groupId: null })),
            );
            next.ungroupedCompleted.push(
              ...group.completedTasks.map((task) => ({ ...task, groupId: null })),
            );
            next.ungroupedCompleted.sort((a, b) =>
              (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
            );
          }
          return next;
        },
      }),
    [mutate],
  );

  const moveTaskTo = useCallback(
    (input: MoveTaskDto) =>
      mutate(() => taskActions.moveTaskAction(input), {
        optimistic: (prev) => {
          const removed = removeTask(prev, input.taskId);
          if (!removed) return prev;
          return insertTask(
            removed.board,
            removed.task,
            input.targetGroupId ?? null,
            input.beforeTaskId,
            input.afterTaskId,
          );
        },
      }),
    [mutate],
  );

  const deleteTask = useCallback(
    (taskId: string) =>
      mutate(() => taskActions.deleteTaskAction({ taskId }), {
        successMessage: "Task deleted.",
        optimistic: (prev) => {
          const removed = removeTask(prev, taskId);
          return removed ? removed.board : prev;
        },
      }),
    [mutate],
  );

  const setTaskCompleted = useCallback(
    (taskId: string, completed: boolean) =>
      mutate(() => taskActions.setTaskCompletedAction({ taskId, completed }), {
        optimistic: (prev) => {
          const removed = removeTask(prev, taskId);
          if (!removed) return prev;
          const task: TaskResponseDto = {
            ...removed.task,
            completedAt: completed ? new Date().toISOString() : null,
          };
          return insertTask(removed.board, task, task.groupId, null, null, "position");
        },
      }),
    [mutate],
  );

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  return {
    board,
    pending,
    collapsed,
    toggleCollapse,
    upsertTask,
    removeTaskById,
    createGroup,
    renameGroup,
    recolorGroup,
    applyGroupOrder,
    moveGroupBy,
    deleteGroupWith,
    moveTaskTo,
    deleteTask,
    setTaskCompleted,
    resync,
  };
}
