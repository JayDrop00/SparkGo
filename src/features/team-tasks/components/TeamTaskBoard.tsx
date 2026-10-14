"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type {
  TeamTaskActivityDto,
  TeamTaskDto,
  TeamTaskGroupDto,
  TeamTaskHelpRequestDto,
  TeamTaskMemberDto,
} from "../dto/team-task.dto";
import {
  archiveTeamTaskAction,
  cancelCompletionRequestAction,
  deleteTeamGroupAction,
  getTeamTaskActivityAction,
  moveTeamTaskAction,
  reorderTeamGroupsAction,
  requestTeamTaskHelpAction,
  reviewCompletionRequestAction,
  setTeamTaskStatusAction,
  submitCompletionRequestAction,
  updateTeamTaskHelpAction,
} from "../actions/team-task.actions";
import type { TeamTaskPageData } from "../services/team-task.service";
import TeamGroupCreateDialog from "./TeamGroupCreateDialog";
import TeamTaskCreateDialog from "./TeamTaskCreateDialog";
import TeamTaskEditForm from "./TeamTaskEditForm";
import TeamTaskColumn from "./TeamTaskColumn";
import TeamTaskCard from "./TeamTaskCard";
import TeamTaskToolbar, { type BoardFilter } from "./TeamTaskToolbar";
import TeamTaskStats from "./TeamTaskStats";
import TeamTaskQuickFab from "./TeamTaskQuickFab";

type TaskView = "active" | "completed" | "archived";
type ActivityPeriod = "today" | "week" | "all";
const isManager = (role: string) => role === "admin" || role === "manager";
const DIFFICULTY_LABELS = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  VERY_HARD: "Very hard",
};

function initials(name: string | null, fallback: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length
    ? parts
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : fallback.slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPeriodRange(period: ActivityPeriod) {
  if (period === "all") return { startAt: null, endAt: null };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const daysFromMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysFromMonday);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + (period === "week" ? 7 : 1));
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function statusLabel(task: TeamTaskDto) {
  if (task.status === "done") return "Completed";
  if (task.status === "in_progress") return "In progress";
  return "To do";
}

function HelpRequestRow({
  request,
  userId,
  canResolve,
  onResolve,
  onCancel,
}: {
  request: TeamTaskHelpRequestDto;
  userId: string;
  canResolve: boolean;
  onResolve: () => void;
  onCancel: () => void;
}) {
  const isMine = request.requesterId === userId;
  return (
    <div
      className={`rounded-xl border p-3 ${
        request.status === "open"
          ? "border-theme-accent/30 bg-theme-accent/5"
          : "border-ink-border bg-ink-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-accent/15 font-ui text-[10px] font-bold text-theme-accent">
            {initials(request.requesterName, request.requesterId ?? "??")}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {request.requesterName || "Former teammate"}
              {isMine ? " · you" : ""}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatDate(request.createdAt)}
              {request.status !== "open" ? ` · ${request.status}` : " · Needs help"}
            </p>
            {request.message && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                {request.message}
              </p>
            )}
          </div>
        </div>
        {request.status === "open" &&
          (isMine ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : canResolve ? (
            <Button size="sm" variant="secondary" onClick={onResolve}>
              Resolve
            </Button>
          ) : null)}
      </div>
    </div>
  );
}

const collisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const groupContainers = args.droppableContainers.filter(
    (container) =>
      container.data.current?.kind === "group" &&
      typeof container.data.current?.groupId === "string",
  );
  if (kind === "group" && args.pointerCoordinates) {
    const hits = pointerWithin({
      ...args,
      droppableContainers: groupContainers.filter(
        (container) => container.id !== args.active.id,
      ),
    });
    if (hits.length) return hits;
  }
  return closestCorners({
    ...args,
    droppableContainers:
      kind === "group"
        ? groupContainers
        : args.droppableContainers.filter(
            (container) => container.data.current?.kind !== "group",
          ),
  });
};

export default function TeamTaskBoard({
  data,
  userId,
  now,
}: {
  data: TeamTaskPageData;
  userId: string;
  now: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  // Filters & Views
  const [view, setView] = useState<TaskView>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BoardFilter>({ type: "none" });

  // Activity Section State
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("week");
  const [activityState, setActivityState] = useState<{
    key: string;
    data: TeamTaskActivityDto | null;
    error: string | null;
  } | null>(null);

  // Dialogs
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskGroupId, setCreateTaskGroupId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");

  // Column Ordering & Collapsing
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupOrder, setGroupOrder] = useState(() => data.groups.map((group) => group.id));

  // Dragging State
  const [draggingTask, setDraggingTask] = useState<TeamTaskDto | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [glowingTaskId, setGlowingTaskId] = useState<string | null>(null);

  const team = data.team;
  const teamId = team?.id ?? null;
  const canManage = Boolean(team && isManager(team.role));

  const activityKey = teamId ? `${teamId}:${activityPeriod}` : null;
  const currentActivity = activityKey && activityState?.key === activityKey ? activityState : null;
  const activity = currentActivity?.data ?? null;
  const activityLoading = Boolean(teamId && !currentActivity);
  const activityError = currentActivity?.error ?? null;

  // Ordered groups
  const orderedGroups = useMemo(() => {
    const groupsById = new Map(data.groups.map((group) => [group.id, group]));
    const ordered = groupOrder.flatMap((id) => {
      const group = groupsById.get(id);
      return group ? [group] : [];
    });
    const orderedIds = new Set(ordered.map((group) => group.id));
    return [...ordered, ...data.groups.filter((group) => !orderedIds.has(group.id))];
  }, [data.groups, groupOrder]);

  useEffect(() => {
    setGroupOrder(data.groups.map((group) => group.id));
  }, [data.groups, teamId]);

  // Fetch Activity Metrics
  function loadActivity() {
    if (!teamId) return;
    const range = getPeriodRange(activityPeriod);
    const key = `${teamId}:${activityPeriod}`;
    void getTeamTaskActivityAction({ teamId, ...range })
      .then((result) => {
        if (!result.ok) {
          setActivityState({ key, data: null, error: result.error.message });
        } else {
          setActivityState({ key, data: result.data, error: null });
        }
      })
      .catch(() => {
        setActivityState({ key, data: null, error: "Activity could not be loaded." });
      });
  }

  useEffect(() => {
    loadActivity();
  }, [activityPeriod, teamId]);

  useEffect(() => {
    if (!glowingTaskId) return;
    const timeout = window.setTimeout(() => setGlowingTaskId(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [glowingTaskId]);

  // Filtering visible tasks
  const visibleTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      // 1. Tab View Filter
      if (view === "active") {
        if (task.archivedAt || task.status === "done") return false;
      } else if (view === "completed") {
        if (task.archivedAt || task.status !== "done") return false;
      } else if (view === "archived") {
        if (!task.archivedAt) return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = task.name.toLowerCase().includes(q);
        const matchesDesc = (task.description ?? "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      // 3. Active Custom Filter
      if (activeFilter.type === "overdue") {
        const isOverdue =
          task.dueAt &&
          task.status !== "done" &&
          !task.archivedAt &&
          new Date(task.dueAt).getTime() < now;
        if (!isOverdue) return false;
      } else if (activeFilter.type === "status") {
        if (activeFilter.value === "in_review") {
          if (task.latestRequest?.status !== "pending") return false;
        } else if (activeFilter.value) {
          if (task.status !== activeFilter.value) return false;
        }
      } else if (activeFilter.type === "priority") {
        const difficultyByPriority: Record<string, string> = {
          urgent: "VERY_HARD",
          high: "HARD",
          medium: "MEDIUM",
          low: "EASY",
        };
        if (task.difficulty !== difficultyByPriority[activeFilter.value ?? ""]) {
          return false;
        }
      } else if (activeFilter.type === "assignee") {
        if (!task.assigneeIds.includes(activeFilter.value ?? "")) return false;
      } else if (activeFilter.type === "help") {
        const hasHelp = task.helpRequests.some((r) => r.status === "open");
        if (!hasHelp) return false;
      }

      return true;
    });
  }, [data.tasks, view, searchQuery, activeFilter, now]);

  const activeCount = useMemo(
    () =>
      data.tasks.filter(
        (t) => !t.archivedAt && (t.status === "todo" || t.status === "in_progress"),
      ).length,
    [data.tasks],
  );
  const completedCount = useMemo(
    () => data.tasks.filter((t) => !t.archivedAt && t.status === "done").length,
    [data.tasks],
  );
  const archivedCount = useMemo(
    () => data.tasks.filter((t) => Boolean(t.archivedAt)).length,
    [data.tasks],
  );

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeRequests = selectedTask?.helpRequests.filter((r) => r.status === "open") ?? [];
  const selectedTaskIsAssigned = Boolean(selectedTask?.assigneeIds.includes(userId));
  const selectedTaskOwnRequest =
    activeRequests.find((r) => r.requesterId === userId) ?? null;
  const pendingReviews = data.requests.filter((r) => r.status === "pending");

  // Sensors & announcements
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const describeDragItem = (id: string) => {
    if (id.startsWith("group:")) {
      const group = data.groups.find((item) => item.id === id.slice("group:".length));
      return group ? `group ${group.name}` : "group";
    }
    if (id.startsWith("task:")) {
      const task = data.tasks.find((item) => item.id === id.slice("task:".length));
      return task ? `task ${task.name}` : "task";
    }
    if (id === "bucket:ungrouped") return "Ungrouped";
    if (id.startsWith("bucket:")) {
      const group = data.groups.find((item) => item.id === id.slice("bucket:".length));
      return group ? `${group.name}` : "a group";
    }
    return "item";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describeDragItem(String(active.id))}.`,
    onDragOver: ({ over }) =>
      over
        ? `Now over ${describeDragItem(String(over.id))}.`
        : "No longer over a droppable area.",
    onDragEnd: ({ active, over }) =>
      over
        ? `Placed ${describeDragItem(String(active.id))} over ${describeDragItem(String(over.id))}.`
        : `${describeDragItem(String(active.id))} was dropped outside a droppable area.`,
    onDragCancel: ({ active }) =>
      `Dragging was cancelled. ${describeDragItem(String(active.id))} returned to its original position.`,
  };

  async function runMutation(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
    onError?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        onError?.();
        toast.error(result.error?.message ?? "Could not save changes.");
      } else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  function openTask(task: TeamTaskDto) {
    setSelectedTaskId(task.id);
    setEditingTask(false);
    setHelpMessage("");
  }

  function closeTask() {
    setSelectedTaskId(null);
    setEditingTask(false);
    setHelpMessage("");
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    setDraggingGroupId(null);
    const { active, over } = event;
    if (!over || !team) return;
    const activeKind = active.data.current?.kind;
    const overKind = over.data.current?.kind;

    if (activeKind === "group") {
      const activeId = String(active.id).slice("group:".length);
      const overId = overKind === "group" ? String(over.id).slice("group:".length) : null;
      if (!overId || overId === activeId) return;
      const groupIds = orderedGroups.map((group) => group.id);
      const from = groupIds.indexOf(activeId);
      const to = groupIds.indexOf(overId);
      if (from < 0 || to < 0) return;
      groupIds.splice(from, 1);
      groupIds.splice(to, 0, activeId);
      setGroupOrder(groupIds);
      runMutation(
        () => reorderTeamGroupsAction({ teamId: team.id, groupIds }),
        "Group order saved.",
        () => setGroupOrder(data.groups.map((group) => group.id)),
      );
      return;
    }

    if (activeKind !== "task" || !canManage || view === "archived") return;
    if (String(over.id) === String(active.id)) return;
    const task = data.tasks.find((item) => item.id === active.data.current?.taskId);
    if (!task) return;

    let targetGroupId: string | null = null;
    let beforeTaskId: string | null = null;
    let afterTaskId: string | null = null;

    if (overKind === "bucket") {
      targetGroupId = (over.data.current?.groupId as string | null | undefined) ?? null;
      const siblings = visibleTasks.filter(
        (item) => item.groupId === targetGroupId && item.id !== task.id,
      );
      afterTaskId = siblings.at(-1)?.id ?? null;
    } else if (overKind === "task") {
      const target = data.tasks.find((item) => item.id === over.data.current?.taskId);
      if (!target) return;
      targetGroupId = target.groupId;
      const siblings = visibleTasks.filter(
        (item) => item.groupId === targetGroupId && item.id !== task.id,
      );
      const targetIndex = siblings.findIndex((item) => item.id === target.id);
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      const overRect = over.rect;
      const insertAfter = activeRect
        ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
        : false;
      if (targetIndex >= 0 && insertAfter) {
        afterTaskId = target.id;
        beforeTaskId = siblings[targetIndex + 1]?.id ?? null;
      } else if (targetIndex >= 0) {
        beforeTaskId = target.id;
        afterTaskId = siblings[targetIndex - 1]?.id ?? null;
      }
    } else if (overKind === "group") {
      targetGroupId = over.data.current?.groupId as string;
      const siblings = visibleTasks.filter(
        (item) => item.groupId === targetGroupId && item.id !== task.id,
      );
      afterTaskId = siblings.at(-1)?.id ?? null;
    } else return;

    if (
      task.groupId === targetGroupId &&
      beforeTaskId === null &&
      afterTaskId === null &&
      visibleTasks.filter((item) => item.groupId === targetGroupId).length === 1
    ) {
      return;
    }

    runMutation(
      () =>
        moveTeamTaskAction({
          taskId: task.id,
          groupId: targetGroupId,
          beforeTaskId,
          afterTaskId,
        }),
      "Task moved.",
    );
  }

  async function submitHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;
    startTransition(async () => {
      const result = await requestTeamTaskHelpAction({
        taskId: selectedTask.id,
        message: helpMessage.trim() || null,
      });
      if (!result.ok) toast.error(result.error.message);
      else {
        toast.success("Your team has been notified.");
        setHelpMessage("");
        setGlowingTaskId(selectedTask.id);
        router.refresh();
      }
    });
  }

  function deleteGroup(group: TeamTaskGroupDto) {
    if (!window.confirm(`Remove “${group.name}”? Its tasks will be kept in Ungrouped.`)) {
      return;
    }
    runMutation(
      () => deleteTeamGroupAction({ groupId: group.id, mode: "ungroup" }),
      "Group removed. Tasks were kept in Ungrouped.",
    );
  }

  function handleOpenCreateWithGroup(groupId: string | null) {
    setCreateTaskGroupId(groupId);
    setCreateTaskOpen(true);
  }

  if (!team) {
    return (
      <EmptyState
        icon="users"
        title={data.invalidTeam ? "Team not found" : "No team yet"}
        description={
          data.invalidTeam
            ? "This team is unavailable or you are no longer a member."
            : "Create or join a team in My Team before managing team tasks."
        }
      />
    );
  }

  const columns = [
    {
      id: null,
      group: null,
      tasks: visibleTasks.filter((task) => task.groupId === null),
    },
    ...orderedGroups.map((group) => ({
      id: group.id,
      group,
      tasks: visibleTasks.filter((task) => task.groupId === group.id),
    })),
  ];

  const draggingGroup = orderedGroups.find((g) => g.id === draggingGroupId) ?? null;
  const draggingGroupTasks = draggingGroup
    ? columns.find((c) => c.id === draggingGroup.id)?.tasks ?? []
    : [];

  return (
    <div className="relative min-h-screen -mx-4 -my-4 sm:-mx-6 sm:-my-6 p-4 sm:p-6 selection:bg-theme-accent/40 overflow-x-hidden space-y-6">
      {/* Top subtle radial gradient glow (theme accent at low opacity) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgb(var(--theme-rgb)/0.1),transparent_70%)]"
        aria-hidden="true"
      />

      {/* PAGE HEADER */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-ink-border pb-5">
        <div>
          <p className="font-data text-xs font-semibold uppercase tracking-widest text-theme-accent">
            Collaborative workspace
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Team Task
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {team.name} · {data.members.length} member{data.members.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Team Switcher select */}
          <div className="relative">
            <select
              aria-label="Select team"
              value={team.id}
              disabled={data.teams.length <= 1}
              onChange={(event) =>
                router.push(`/team-tasks?team=${encodeURIComponent(event.target.value)}`)
              }
              className="appearance-none rounded-xl border border-ink-border bg-ink-input py-2 pl-3.5 pr-8 text-sm font-medium text-white outline-none transition-colors hover:border-theme-accent/50 focus:border-theme-accent disabled:opacity-75 cursor-pointer"
            >
              {data.teams.map((item) => (
                <option key={item.id} value={item.id} className="bg-ink-surface text-white">
                  {item.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-transparent px-3.5 py-2 text-sm font-medium text-slate-200 transition-all hover:border-theme-accent/50 hover:bg-ink-border/50"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Add group</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenCreateWithGroup(null)}
                className="flex items-center gap-1.5 rounded-xl bg-linear-to-br from-theme-accent to-theme-secondary px-4 py-2 text-sm font-semibold text-ink-base shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgb(var(--theme-rgb)/0.6)] active:translate-y-px cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create new task</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* PART B: TEAM PULSE STATS SECTION */}
      <TeamTaskStats
        tasks={data.tasks}
        now={now}
        activityPeriod={activityPeriod}
        onActivityPeriodChange={setActivityPeriod}
        activityMetrics={activity}
        activityLoading={activityLoading}
        activityError={activityError}
        onRetryActivity={loadActivity}
        members={data.members}
        onSelectFilter={(filter) => setActiveFilter(filter)}
        onCreateTask={() => handleOpenCreateWithGroup(null)}
      />

      {/* COMPLETION REVIEWS (for managers) */}
      {canManage && pendingReviews.length > 0 && (
        <section className="hud-card rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-theme-accent/20 text-theme-accent">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <h2 className="font-ui text-sm font-bold text-white">
                Completion Review Requests
              </h2>
            </div>
            <span className="rounded-full bg-theme-accent/15 px-2.5 py-0.5 text-xs font-semibold text-theme-accent">
              {pendingReviews.length} pending
            </span>
          </div>

          <ul className="grid gap-2.5 md:grid-cols-2">
            {pendingReviews.map((request) => {
              const task = data.tasks.find((item) => item.id === request.taskId);
              const member = data.members.find((item) => item.id === request.requestedBy);
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-border bg-ink-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {task?.name ?? "Team task"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {member?.name ?? "A teammate"} · {formatDate(request.createdAt)}
                      {request.note ? ` · “${request.note}”` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        runMutation(
                          () =>
                            reviewCompletionRequestAction({
                              requestId: request.id,
                              approve: true,
                            }),
                          "Task completed.",
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        runMutation(
                          () =>
                            reviewCompletionRequestAction({
                              requestId: request.id,
                              approve: false,
                            }),
                          "Request returned to the active task.",
                        )
                      }
                    >
                      Return
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* PART A: TASK BOARD SECTION */}
      <section id="team-task-kanban-board" className="relative space-y-4 pt-2">
        {/* TOOLBAR ABOVE BOARD */}
        <TeamTaskToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          view={view}
          onViewChange={setView}
          activeCount={activeCount}
          completedCount={completedCount}
          archivedCount={archivedCount}
          canManage={canManage}
          onCreateTask={() => handleOpenCreateWithGroup(null)}
          onAddGroup={() => setCreateGroupOpen(true)}
          activeFilter={activeFilter}
          onClearFilter={() => setActiveFilter({ type: "none" })}
          members={data.members}
          onApplyFilter={(filter) => setActiveFilter(filter)}
        />

        {/* MOBILE STICKY GROUP PILLS ROW */}
        <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 kanban-board-scroll">
          {columns.map((col) => {
            const colName = col.group?.name ?? "Ungrouped";
            const colId = col.group?.id ?? "ungrouped";
            return (
              <button
                key={colId}
                type="button"
                onClick={() => {
                  document
                    .getElementById(`col-${colId}`)
                    ?.scrollIntoView({ behavior: "smooth", inline: "center" });
                }}
                className="shrink-0 rounded-full border border-ink-border bg-ink-surface px-3 py-1 text-xs font-semibold text-slate-400 hover:text-white hover:border-theme-accent/40 cursor-pointer"
              >
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: col.group?.color ?? "var(--theme-accent)" }}
                />
                {colName} ({col.tasks.length})
              </button>
            );
          })}
        </div>

        {/* EMPTY STATE IF NO TASKS VISIBLE */}
        {view === "active" && !canManage && visibleTasks.length === 0 && (
          <EmptyState
            icon="checked"
            title="No active tasks assigned"
            description="When a task is assigned to you, it will appear here."
          />
        )}

        {view !== "active" && visibleTasks.length === 0 ? (
          <EmptyState
            icon={view === "completed" ? "checked" : "layers"}
            title={view === "completed" ? "No completed tasks yet" : "No archived tasks found"}
            description={
              view === "completed"
                ? "Completed team tasks will be collected here."
                : searchQuery
                ? "Try a different search term or clear the filter."
                : "Archived tasks stay available here for reference."
            }
          />
        ) : (
          /* KANBAN BOARD (dnd-kit context) */
          <DndContext
            id="team-task-workspace-board"
            sensors={sensors}
            collisionDetection={collisionDetection}
            accessibility={{ announcements }}
            onDragStart={(event) => {
              if (event.active.data.current?.kind === "task") {
                setDraggingGroupId(null);
                setDraggingTask(
                  data.tasks.find((task) => task.id === event.active.data.current?.taskId) ??
                    null,
                );
              } else if (event.active.data.current?.kind === "group") {
                setDraggingTask(null);
                setDraggingGroupId(String(event.active.data.current.groupId));
              }
            }}
            onDragCancel={() => {
              setDraggingTask(null);
              setDraggingGroupId(null);
            }}
            onDragEnd={handleDragEnd}
          >
            <div className="flex max-w-full items-start gap-4 overflow-x-auto pb-24 sm:pb-12 kanban-board-scroll snap-x snap-mandatory">
              {/* Pinned Ungrouped Column */}
              <TeamTaskColumn
                group={null}
                tasks={columns[0].tasks}
                allTasks={data.tasks}
                now={now}
                view={view}
                members={data.members}
                canManage={canManage}
                collapsed={false}
                glowingTaskId={glowingTaskId}
                onToggleCollapse={() => undefined}
                onDeleteGroup={() => undefined}
                onOpenTask={openTask}
                onStartTask={(task) =>
                  runMutation(
                    () => setTeamTaskStatusAction({ taskId: task.id, status: "in_progress" }),
                    "Work started.",
                  )
                }
                onCompleteTask={(task) =>
                  runMutation(
                    () => setTeamTaskStatusAction({ taskId: task.id, status: "done" }),
                    "Task completed.",
                  )
                }
                onAddTaskToGroup={handleOpenCreateWithGroup}
              />

              {/* Group Columns (Horizontal SortableContext) */}
              <SortableContext
                items={orderedGroups.map((group) => `group:${group.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {columns.slice(1).map(
                  ({ group, tasks }) =>
                    group && (
                      <TeamTaskColumn
                        key={group.id}
                        group={group}
                        tasks={tasks}
                        allTasks={data.tasks}
                        now={now}
                        view={view}
                        members={data.members}
                        canManage={canManage}
                        collapsed={collapsedGroups.has(group.id)}
                        glowingTaskId={glowingTaskId}
                        onToggleCollapse={() =>
                          setCollapsedGroups((current) => {
                            const next = new Set(current);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          })
                        }
                        onDeleteGroup={deleteGroup}
                        onOpenTask={openTask}
                        onStartTask={(task) =>
                          runMutation(
                            () => setTeamTaskStatusAction({ taskId: task.id, status: "in_progress" }),
                            "Work started.",
                          )
                        }
                        onCompleteTask={(task) =>
                          runMutation(
                            () => setTeamTaskStatusAction({ taskId: task.id, status: "done" }),
                            "Task completed.",
                          )
                        }
                        onAddTaskToGroup={handleOpenCreateWithGroup}
                      />
                    ),
                )}
              </SortableContext>
            </div>

            {/* Drag Overlay for smooth preview */}
            <DragOverlay>
              {draggingGroup && (
                <div className="w-[295px] rounded-2xl border border-theme-accent bg-ink-card p-3.5 shadow-2xl scale-[1.02] opacity-95 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: draggingGroup.color ?? "var(--theme-accent)" }}
                    />
                    <span className="font-bold text-white">{draggingGroup.name}</span>
                    <span className="text-xs text-slate-500">
                      ({draggingGroupTasks.length})
                    </span>
                  </div>
                </div>
              )}
              {draggingTask && (
                <div className="w-[290px] rotate-2 rounded-xl border border-theme-accent/80 bg-ink-border p-3.5 shadow-2xl scale-[1.02] pointer-events-none text-left">
                  <h4 className="text-[15px] font-semibold text-white line-clamp-2">
                    {draggingTask.name}
                  </h4>
                  {draggingTask.description && (
                    <p className="mt-1 text-[13px] text-slate-500 line-clamp-1">
                      {draggingTask.description}
                    </p>
                  )}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      {/* FLOATING ACTION BUTTON (Bottom Right) */}
      <TeamTaskQuickFab onClick={() => handleOpenCreateWithGroup(null)} />

      {/* CREATE TASK DIALOG */}
      <TeamTaskCreateDialog
        key={team.id}
        open={createTaskOpen}
        onClose={() => {
          setCreateTaskOpen(false);
          setCreateTaskGroupId(null);
        }}
        teamId={team.id}
        groups={data.groups}
        members={data.members}
        userId={userId}
        defaultGroupId={createTaskGroupId}
      />

      {/* CREATE GROUP DIALOG */}
      <TeamGroupCreateDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        teamId={team.id}
      />

      {/* TASK DETAILS MODAL */}
      <Dialog
        open={selectedTask !== null}
        onClose={closeTask}
        title={selectedTask?.name ?? "Task details"}
        description={
          selectedTask
            ? `${statusLabel(selectedTask)} · ${
                DIFFICULTY_LABELS[selectedTask.difficulty]
              }${selectedTask.dueAt ? ` · Due ${formatDate(selectedTask.dueAt)}` : ""}`
            : undefined
        }
        maxWidth="max-w-3xl"
      >
        {selectedTask && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-ink-border bg-ink-surface p-4 sm:grid-cols-3">
              <div>
                <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Created
                </p>
                <p className="mt-1 text-sm text-white">
                  {formatDate(selectedTask.createdAt)}
                </p>
              </div>
              <div>
                <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Started
                </p>
                <p className="mt-1 text-sm text-white">
                  {selectedTask.startedAt ? formatDate(selectedTask.startedAt) : "Not started"}
                </p>
              </div>
              <div>
                <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Completed
                </p>
                <p className="mt-1 text-sm text-white">
                  {selectedTask.completedAt ? formatDate(selectedTask.completedAt) : "—"}
                </p>
              </div>

              <div className="sm:col-span-3">
                <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned members
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTask.assigneeIds.length ? (
                    selectedTask.assigneeIds.map((id) => {
                      const member = data.members.find((item) => item.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink-border bg-ink-card px-2.5 py-1 text-xs text-slate-400"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-border text-[9px] font-bold text-white">
                            {initials(member?.name ?? null, id)}
                          </span>
                          {member?.name ?? "Former teammate"}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-slate-500">No assigned members.</span>
                  )}
                </div>
              </div>

              {selectedTask.description && (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-400 sm:col-span-3">
                  {selectedTask.description}
                </p>
              )}
            </div>

            {canManage && !editingTask && (
              <div className="flex flex-wrap gap-2">
                {!selectedTask.archivedAt && selectedTask.status === "done" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runMutation(
                        () =>
                          setTeamTaskStatusAction({
                            taskId: selectedTask.id,
                            status: "in_progress",
                          }),
                        "Task reopened.",
                      )
                    }
                  >
                    Reopen task
                  </Button>
                )}
                {!selectedTask.archivedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      runMutation(
                        () =>
                          archiveTeamTaskAction({
                            taskId: selectedTask.id,
                            archived: true,
                          }),
                        "Task archived.",
                      )
                    }
                  >
                    Archive
                  </Button>
                )}
                {selectedTask.archivedAt && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runMutation(
                        () =>
                          archiveTeamTaskAction({
                            taskId: selectedTask.id,
                            archived: false,
                          }),
                        `Task restored to ${
                          selectedTask.status === "done" ? "Completed" : "Active"
                        }`,
                      )
                    }
                  >
                    Restore to {selectedTask.status === "done" ? "Completed" : "Active"}
                  </Button>
                )}
                {!selectedTask.archivedAt && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingTask(true)}>
                    Edit task
                  </Button>
                )}
              </div>
            )}

            {canManage && editingTask && (
              <TeamTaskEditForm
                teamId={team.id}
                task={selectedTask}
                groups={data.groups}
                members={data.members}
                onCancel={() => setEditingTask(false)}
              />
            )}

            {selectedTask.status === "todo" &&
              selectedTaskIsAssigned &&
              !selectedTask.archivedAt && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    runMutation(
                      () =>
                        setTeamTaskStatusAction({
                          taskId: selectedTask.id,
                          status: "in_progress",
                        }),
                      "Work started.",
                    )
                  }
                >
                  Start work
                </Button>
              )}
            {selectedTask.status === "in_progress" &&
              selectedTaskIsAssigned &&
              !selectedTask.archivedAt &&
              selectedTask.latestRequest?.status !== "pending" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    runMutation(
                      () => submitCompletionRequestAction({ taskId: selectedTask.id }),
                      "Completion request sent for review.",
                    )
                  }
                >
                  Request completion
                </Button>
              )}
            {selectedTask.latestRequest?.status === "pending" &&
              selectedTask.latestRequest.requestedBy === userId && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    runMutation(
                      () =>
                        cancelCompletionRequestAction({
                          requestId: selectedTask.latestRequest!.id,
                        }),
                      "Completion request cancelled.",
                    )
                  }
                >
                  Cancel completion request
                </Button>
              )}

            <section className="space-y-3 border-t border-ink-border pt-4">
              <div>
                <h3 className="font-display font-bold text-white">Need help</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Help requests stay separate from the task’s progress.
                </p>
              </div>

              {activeRequests.length > 0 ? (
                <div className="space-y-2">
                  {activeRequests.map((request) => (
                    <HelpRequestRow
                      key={request.id}
                      request={request}
                      userId={userId}
                      canResolve={selectedTaskIsAssigned || canManage}
                      onResolve={() =>
                        runMutation(
                          () => updateTeamTaskHelpAction({ requestId: request.id, resolve: true }),
                          "Help request resolved.",
                        )
                      }
                      onCancel={() =>
                        runMutation(
                          () => updateTeamTaskHelpAction({ requestId: request.id, resolve: false }),
                          "Help request cancelled.",
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-ink-border p-3 text-sm text-slate-500">
                  No one has an active help request for this task.
                </p>
              )}

              {selectedTaskIsAssigned &&
                !selectedTaskOwnRequest &&
                !selectedTask.archivedAt &&
                selectedTask.status !== "done" && (
                  <form onSubmit={submitHelp} className="space-y-2">
                    <Field label="Ask your team">
                      <Textarea
                        value={helpMessage}
                        onChange={(event) => setHelpMessage(event.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="What are you blocked on? (optional)"
                      />
                    </Field>
                    <Button size="sm" type="submit" loading={pending}>
                      Need help
                    </Button>
                  </form>
                )}

              {selectedTaskOwnRequest && (
                <p className="rounded-lg border border-theme-accent/20 bg-theme-accent/5 px-3 py-2 text-xs text-theme-accent">
                  Your help request is active. You can cancel it above if the issue is resolved.
                </p>
              )}

              {selectedTask.helpRequests.some((request) => request.status !== "open") && (
                <details className="rounded-xl border border-ink-border p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                    Help request history
                  </summary>
                  <div className="mt-3 space-y-2">
                    {selectedTask.helpRequests
                      .filter((request) => request.status !== "open")
                      .map((request) => (
                        <HelpRequestRow
                          key={request.id}
                          request={request}
                          userId={userId}
                          canResolve={false}
                          onResolve={() => undefined}
                          onCancel={() => undefined}
                        />
                      ))}
                  </div>
                </details>
              )}
            </section>
          </div>
        )}
      </Dialog>
    </div>
  );
}
