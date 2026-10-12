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
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { TeamTaskActivityDto, TeamTaskDto, TeamTaskGroupDto, TeamTaskHelpRequestDto, TeamTaskMemberDto } from "../dto/team-task.dto";
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

type TaskView = "active" | "completed" | "archived";
type ActivityPeriod = "today" | "week" | "all";
const isManager = (role: string) => role === "admin" || role === "manager";
const DIFFICULTY_LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard", VERY_HARD: "Very hard" };

function initials(name: string | null, fallback: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() : fallback.slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
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

function StatusPill({ task }: { task: TeamTaskDto }) {
  const tone = task.status === "done" ? "bg-emerald-400/10 text-emerald-300" : task.status === "in_progress" ? "bg-sky-400/10 text-sky-300" : "bg-ink-border/60 text-slate-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{statusLabel(task)}</span>;
}

function AvatarStack({ members, ids }: { members: TeamTaskMemberDto[]; ids: string[] }) {
  if (!ids.length) return <span className="text-xs text-slate-500">Unassigned</span>;
  const visible = ids.slice(0, 4);
  return (
    <div className="flex items-center -space-x-2" aria-label={`Assigned to ${ids.length} member${ids.length === 1 ? "" : "s"}`}>
      {visible.map((id) => {
        const member = members.find((item) => item.id === id);
        const name = member?.name || `Member ${id.slice(0, 6)}`;
        return <span key={id} title={name} aria-label={name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink-card bg-ink-border font-data text-[9px] font-bold text-white">{initials(member?.name ?? null, id)}</span>;
      })}
      {ids.length > visible.length && <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-ink-card bg-ink-input px-1 font-data text-[9px] text-slate-300">+{ids.length - visible.length}</span>}
    </div>
  );
}

function StatCard({ label, value, hint, tone, icon }: { label: string; value: string | number; hint: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="hud-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p><p className={`mt-2 font-display text-3xl font-extrabold ${tone}`}>{value}</p></div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-ink-base/70 ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function TaskCard({
  task,
  now,
  members,
  canManage,
  draggable,
  glowing,
  onOpen,
  onStart,
  onComplete,
}: {
  task: TeamTaskDto;
  now: number;
  members: TeamTaskMemberDto[];
  canManage: boolean;
  draggable: boolean;
  glowing: boolean;
  onOpen: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    disabled: !draggable,
    data: { kind: "task", taskId: task.id },
  });
  const openRequests = task.helpRequests.filter((request) => request.status === "open");
  const overdue = Boolean(task.dueAt && task.status !== "done" && !task.archivedAt && new Date(task.dueAt).getTime() < now);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group rounded-xl border bg-ink-base/65 p-3 shadow-sm transition-colors ${isDragging ? "opacity-35" : ""} ${glowing ? "animate-[pulse_1.4s_ease-in-out_2] border-theme-accent shadow-[0_0_24px_rgb(var(--theme-rgb)/0.28)] motion-reduce:animate-none" : openRequests.length ? "border-theme-accent/50" : "border-ink-border hover:border-slate-500"}`}
    >
      <div className="flex items-start gap-2">
        {draggable && <button type="button" aria-label={`Drag ${task.name}`} {...attributes} {...listeners} className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-slate-600 hover:bg-ink-border hover:text-white active:cursor-grabbing"><Icon name="grip" className="h-4 w-4" /></button>}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block break-words text-sm font-semibold text-white">{task.name}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5"><StatusPill task={task} /><Badge tone="neutral">{DIFFICULTY_LABELS[task.difficulty]}</Badge></span>
        </button>
        {canManage && task.status !== "done" && <button type="button" onClick={onComplete} className="shrink-0 rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-400/10" aria-label={`Complete ${task.name}`} title="Mark completed"><Icon name="check" className="h-4 w-4" /></button>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <AvatarStack members={members} ids={task.assigneeIds} />
        {task.dueAt && <span className={`inline-flex items-center gap-1 truncate text-[11px] ${overdue ? "font-semibold text-rose-300" : "text-slate-400"}`}><Icon name="calendar" className="h-3 w-3" />{overdue ? "Overdue · " : "Due "}{formatDate(task.dueAt)}</span>}
      </div>
      {openRequests.length > 0 && (
        <button type="button" onClick={onOpen} className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-theme-accent/30 bg-theme-accent/[0.08] px-2.5 py-2 text-left text-xs text-theme-accent">
          <span className="truncate">Help needed · {openRequests.map((item) => item.requesterName || "A teammate").join(", ")}</span>
          <span className="shrink-0 rounded-full bg-theme-accent/15 px-1.5 py-0.5 font-data">{openRequests.length}</span>
        </button>
      )}
      {task.latestRequest?.status === "pending" && <p className="mt-2 text-[11px] text-theme-accent">Completion request awaiting review</p>}
      {task.status === "todo" && task.assigneeIds.length > 0 && <button type="button" onClick={onStart} className="mt-3 w-full rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-400/10">Start work</button>}
    </article>
  );
}

function SortableGroupHandle({ group, collapsed, onToggle, onDelete, canManage }: {
  group: TeamTaskGroupDto;
  collapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  canManage: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: `group:${group.id}`,
    disabled: !canManage,
    data: { kind: "group", groupId: group.id },
  });
  return (
    <header ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`mb-3 rounded-xl border p-3 ${isOver ? "border-theme-accent bg-theme-accent/10" : "border-ink-border bg-ink-base/50"} ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        {canManage && <button type="button" aria-label={`Reorder ${group.name}`} {...attributes} {...listeners} className="cursor-grab rounded p-1 text-slate-500 hover:bg-ink-border hover:text-white active:cursor-grabbing"><Icon name="grip" className="h-4 w-4" /></button>}
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color ?? "#64748b" }} />
          <span className="truncate font-display text-sm font-bold text-white">{group.name}</span>
          <Icon name={collapsed ? "chevronDown" : "chevronUp"} className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </button>
        {canManage && <button type="button" onClick={onDelete} aria-label={`Remove ${group.name}`} title="Remove group; keep tasks in Ungrouped" className="rounded p-1 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><Icon name="trash" className="h-3.5 w-3.5" /></button>}
      </div>
    </header>
  );
}

function TeamTaskColumn({
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
}) {
  const id = group?.id ?? null;
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${id ?? "ungrouped"}`, data: { kind: "bucket", groupId: id } });
  const allGroupTasks = allTasks.filter((task) => task.groupId === id && !task.archivedAt);
  const completedCount = allGroupTasks.filter((task) => task.status === "done").length;
  const progress = allGroupTasks.length ? Math.round((completedCount / allGroupTasks.length) * 100) : 0;
  const canDragTasks = canManage && view !== "archived";

  return (
    <section ref={setNodeRef} className={`flex w-[min(21rem,84vw)] shrink-0 flex-col rounded-2xl border p-3 transition-colors ${isOver ? "border-theme-accent/80 bg-theme-accent/[0.04]" : "border-ink-border/80 bg-ink-card/45"}`}>
      {group ? (
        <SortableGroupHandle group={group} collapsed={collapsed} onToggle={onToggleCollapse} onDelete={() => onDeleteGroup(group)} canManage={canManage && view !== "archived"} />
      ) : (
        <header className="sticky left-0 z-10 mb-3 rounded-xl border border-theme-accent/30 bg-ink-base p-3 shadow-[8px_0_16px_-8px_rgb(0_0_0/0.6)]">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-display text-sm font-bold text-white"><Icon name="layers" className="h-4 w-4 text-theme-accent" />Ungrouped</span>
            <span className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-2 py-0.5 font-data text-[9px] uppercase tracking-wider text-theme-accent">Pinned</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">No group assigned</p>
        </header>
      )}
      {group && (
        <div className="mb-3 px-1">
          <div className="flex items-center justify-between text-[10px] text-slate-500"><span>{view === "active" ? `${tasks.length} active` : `${tasks.length} shown`}</span><span>{completedCount}/{allGroupTasks.length} completed · {progress}%</span></div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-base"><div className="h-full rounded-full bg-theme-accent transition-[width]" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {!group && <p className="mb-3 px-1 text-[10px] text-slate-500">{view === "active" ? `${tasks.length} active` : `${tasks.length} shown`}</p>}
      {!collapsed && (
        <SortableContext items={tasks.map((task) => `task:${task.id}`)} strategy={verticalListSortingStrategy}>
          <div className="min-h-24 space-y-2.5">
            {tasks.map((task) => <TaskCard key={task.id} task={task} now={now} members={members} canManage={canManage} draggable={canDragTasks} glowing={glowingTaskId === task.id} onOpen={() => onOpenTask(task)} onStart={() => onStartTask(task)} onComplete={() => onCompleteTask(task)} />)}
            {tasks.length === 0 && <p className="rounded-lg border border-dashed border-ink-border px-3 py-6 text-center text-xs text-slate-500">Drop a task here or add one.</p>}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function HelpRequestRow({ request, userId, canResolve, onResolve, onCancel }: {
  request: TeamTaskHelpRequestDto;
  userId: string;
  canResolve: boolean;
  onResolve: () => void;
  onCancel: () => void;
}) {
  const isMine = request.requesterId === userId;
  return (
    <div className={`rounded-xl border p-3 ${request.status === "open" ? "border-theme-accent/30 bg-theme-accent/[0.05]" : "border-ink-border bg-ink-base/40"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-accent/15 font-data text-[10px] font-bold text-theme-accent">{initials(request.requesterName, request.requesterId ?? "??")}</span>
          <div className="min-w-0"><p className="text-sm font-semibold text-white">{request.requesterName || "Former teammate"}{isMine ? " · you" : ""}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(request.createdAt)}{request.status !== "open" ? ` · ${request.status}` : " · Needs help"}</p>{request.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{request.message}</p>}</div>
        </div>
        {request.status === "open" && (isMine ? <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button> : canResolve ? <Button size="sm" variant="secondary" onClick={onResolve}>Resolve</Button> : null)}
      </div>
    </div>
  );
}

function ActivityCards({ metrics, loading }: { metrics: TeamTaskActivityDto | null; loading: boolean }) {
  const items = [
    { name: "Tasks created", value: metrics?.tasksCreated ?? 0, tone: "text-slate-100" },
    { name: "Tasks completed", value: metrics?.tasksCompleted ?? 0, tone: "text-emerald-300" },
    { name: "Tasks started", value: metrics?.tasksStarted ?? 0, tone: "text-sky-300" },
    { name: "Help requests", value: metrics?.helpRequests ?? 0, tone: "text-theme-accent" },
  ];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{items.map((item) => <div key={item.name} className="rounded-xl border border-ink-border/80 bg-ink-base/45 px-3 py-2.5"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{item.name}</p><p className={`mt-1 font-data text-xl font-bold ${item.tone}`}>{loading ? "…" : item.value}</p></div>)}</div>;
}

const collisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const allowed = args.droppableContainers.filter((container) => kind === "group"
    ? container.data.current?.kind === "group" && container.id !== args.active.id
    : container.data.current?.kind !== "group");
  if (kind === "group" && args.pointerCoordinates) {
    const hits = pointerWithin({ ...args, droppableContainers: allowed });
    if (hits.length) return hits;
  }
  return closestCorners({ ...args, droppableContainers: allowed });
};

export default function TeamTaskBoard({ data, userId, now }: { data: TeamTaskPageData; userId: string; now: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<TaskView>("active");
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("week");
  const [activityState, setActivityState] = useState<{ key: string; data: TeamTaskActivityDto | null; error: string | null } | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggingTask, setDraggingTask] = useState<TeamTaskDto | null>(null);
  const [glowingTaskId, setGlowingTaskId] = useState<string | null>(null);
  const [archiveSearch, setArchiveSearch] = useState("");
  const team = data.team;
  const teamId = team?.id ?? null;
  const canManage = Boolean(team && isManager(team.role));
  const activityKey = teamId ? `${teamId}:${activityPeriod}` : null;
  const currentActivity = activityKey && activityState?.key === activityKey ? activityState : null;
  const activity = currentActivity?.data ?? null;
  const activityLoading = Boolean(teamId && !currentActivity);
  const activityError = currentActivity?.error ?? null;

  const taskStats = useMemo(() => {
    const eligible = data.tasks;
    const completed = eligible.filter((task) => task.status === "done").length;
    return {
      total: eligible.length,
      inProgress: eligible.filter((task) => task.status === "in_progress").length,
      completed,
      overdue: eligible.filter((task) => !task.archivedAt && task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() < now).length,
      completionRate: eligible.length ? Math.round((completed / eligible.length) * 100) : 0,
    };
  }, [data.tasks, now]);

  const visibleTasks = useMemo(() => data.tasks.filter((task) => {
    if (view === "active") return !task.archivedAt && (task.status === "todo" || task.status === "in_progress");
    if (view === "completed") return !task.archivedAt && task.status === "done";
    if (!task.archivedAt) return false;
    const query = archiveSearch.trim().toLocaleLowerCase();
    return !query || task.name.toLocaleLowerCase().includes(query) || (task.description ?? "").toLocaleLowerCase().includes(query);
  }), [archiveSearch, data.tasks, view]);
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeRequests = selectedTask?.helpRequests.filter((request) => request.status === "open") ?? [];
  const selectedTaskIsAssigned = Boolean(selectedTask?.assigneeIds.includes(userId));
  const selectedTaskOwnRequest = activeRequests.find((request) => request.requesterId === userId) ?? null;
  const pendingReviews = data.requests.filter((request) => request.status === "pending");

  useEffect(() => {
    if (!teamId) return;
    let ignore = false;
    const range = getPeriodRange(activityPeriod);
    const key = `${teamId}:${activityPeriod}`;
    void getTeamTaskActivityAction({ teamId, ...range }).then((result) => {
      if (ignore) return;
      if (!result.ok) {
        setActivityState({ key, data: null, error: result.error.message });
      } else setActivityState({ key, data: result.data, error: null });
    }).catch(() => {
      if (ignore) return;
      setActivityState({ key, data: null, error: "Activity could not be loaded." });
    });
    return () => { ignore = true; };
  }, [activityPeriod, teamId]);

  useEffect(() => {
    if (!glowingTaskId) return;
    const timeout = window.setTimeout(() => setGlowingTaskId(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [glowingTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function runMutation(action: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error?.message ?? "Could not save changes.");
      else {
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
    const { active, over } = event;
    if (!over || !team) return;
    const activeKind = active.data.current?.kind;
    const overKind = over.data.current?.kind;
    if (activeKind === "group") {
      const activeId = String(active.id).slice("group:".length);
      const overId = overKind === "group" ? String(over.id).slice("group:".length) : null;
      if (!overId || overId === activeId) return;
      const groupIds = data.groups.map((group) => group.id);
      const from = groupIds.indexOf(activeId);
      const to = groupIds.indexOf(overId);
      if (from < 0 || to < 0) return;
      groupIds.splice(from, 1);
      groupIds.splice(to, 0, activeId);
      runMutation(() => reorderTeamGroupsAction({ teamId: team.id, groupIds }), "Group order saved.");
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
      const siblings = visibleTasks.filter((item) => item.groupId === targetGroupId && item.id !== task.id);
      afterTaskId = siblings.at(-1)?.id ?? null;
    } else if (overKind === "task") {
      const target = data.tasks.find((item) => item.id === over.data.current?.taskId);
      if (!target) return;
      targetGroupId = target.groupId;
      const siblings = visibleTasks.filter((item) => item.groupId === targetGroupId && item.id !== task.id);
      const targetIndex = siblings.findIndex((item) => item.id === target.id);
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      const overRect = over.rect;
      const insertAfter = activeRect ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2 : false;
      if (targetIndex >= 0 && insertAfter) {
        afterTaskId = target.id;
        beforeTaskId = siblings[targetIndex + 1]?.id ?? null;
      } else if (targetIndex >= 0) {
        beforeTaskId = target.id;
        afterTaskId = siblings[targetIndex - 1]?.id ?? null;
      }
    } else if (overKind === "group") {
      targetGroupId = over.data.current?.groupId as string;
      const siblings = visibleTasks.filter((item) => item.groupId === targetGroupId && item.id !== task.id);
      afterTaskId = siblings.at(-1)?.id ?? null;
    } else return;

    if (task.groupId === targetGroupId && beforeTaskId === null && afterTaskId === null && visibleTasks.filter((item) => item.groupId === targetGroupId).length === 1) return;
    runMutation(() => moveTeamTaskAction({ taskId: task.id, groupId: targetGroupId, beforeTaskId, afterTaskId }), "Task moved.");
  }

  async function submitHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;
    startTransition(async () => {
      const result = await requestTeamTaskHelpAction({ taskId: selectedTask.id, message: helpMessage.trim() || null });
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
    if (!window.confirm(`Remove “${group.name}”? Its tasks will be kept in Ungrouped.`)) return;
    runMutation(() => deleteTeamGroupAction({ groupId: group.id, mode: "ungroup" }), "Group removed. Tasks were kept in Ungrouped.");
  }

  if (!team) return <EmptyState icon="users" title={data.invalidTeam ? "Team not found" : "No team yet"} description={data.invalidTeam ? "This team is unavailable or you are no longer a member." : "Create or join a team in My Team before managing team tasks."} />;

  const columns = [
    { id: null, group: null, tasks: visibleTasks.filter((task) => task.groupId === null) },
    ...data.groups.map((group) => ({ id: group.id, group, tasks: visibleTasks.filter((task) => task.groupId === group.id) })),
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-data text-[10px] uppercase tracking-[0.25em] text-theme-accent">Collaborative workspace</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Team Task</h1>
          <p className="mt-1 text-sm text-slate-400">{team.name} · {data.members.length} members</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Select team" value={team.id} disabled={data.teams.length <= 1} onChange={(event) => router.push(`/team-tasks?team=${encodeURIComponent(event.target.value)}`)} className="rounded-xl border border-ink-border bg-ink-input px-3 py-2.5 text-sm text-white outline-none focus:border-theme-accent disabled:cursor-default disabled:opacity-80">{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          {canManage && <>
            <Button variant="secondary" onClick={() => setCreateGroupOpen(true)}><Icon name="layers" className="h-4 w-4" />Add group</Button>
            <Button onClick={() => setCreateTaskOpen(true)}><Icon name="plus" className="h-4 w-4" />Create new task</Button>
          </>}
        </div>
      </header>

      <section aria-label="Team task overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total tasks" value={taskStats.total} hint="All non-cancelled tasks, including archived" tone="text-slate-100" icon={<Icon name="layers" className="h-4 w-4" />} />
          <StatCard label="In progress" value={taskStats.inProgress} hint="Work currently underway" tone="text-sky-300" icon={<Icon name="clock" className="h-4 w-4" />} />
          <StatCard label="Completed" value={taskStats.completed} hint="Completed tasks, including archived" tone="text-emerald-300" icon={<Icon name="checked" className="h-4 w-4" />} />
          <StatCard label="Overdue" value={taskStats.overdue} hint="Unfinished, unarchived tasks past due" tone="text-rose-300" icon={<span className="font-data text-lg font-bold">!</span>} />
        </div>
        <div className="mt-3 rounded-2xl border border-ink-border bg-ink-card/60 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Overall completion</p><p className="mt-1 font-display text-2xl font-extrabold text-theme-accent">{taskStats.completionRate}%</p></div><p className="text-xs text-slate-500">{taskStats.completed} of {taskStats.total} eligible tasks completed</p></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-base"><div className="h-full rounded-full bg-linear-to-r from-theme-accent to-theme-secondary transition-[width] duration-300" style={{ width: `${taskStats.completionRate}%` }} /></div>
          {taskStats.total === 0 && <p className="mt-2 text-xs text-slate-500">Create the first team task to start tracking progress.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-border bg-ink-card/50 p-4 sm:p-5" aria-labelledby="team-activity-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="team-activity-heading" className="font-display text-base font-bold text-white">Team activity</h2><p className="mt-0.5 text-xs text-slate-500">Real task and help events for this team.</p></div>
          <div role="group" aria-label="Activity period" className="flex rounded-xl border border-ink-border bg-ink-base p-1">
            {(["today", "week", "all"] as const).map((period) => <button key={period} type="button" aria-pressed={activityPeriod === period} onClick={() => setActivityPeriod(period)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activityPeriod === period ? "bg-theme-accent text-ink-base" : "text-slate-400 hover:text-white"}`}>{period === "today" ? "Today" : period === "week" ? "This week" : "All time"}</button>)}
          </div>
        </div>
        <ActivityCards metrics={activity} loading={activityLoading} />
        {activityError && <p role="status" className="mt-2 text-xs text-rose-300">{activityError}</p>}
      </section>

      {canManage && pendingReviews.length > 0 && <section className="rounded-2xl border border-theme-accent/25 bg-theme-accent/[0.04] p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display font-bold text-white">Completion review</h2><Badge tone="accent">{pendingReviews.length} pending</Badge></div>
        <ul className="grid gap-2 md:grid-cols-2">{pendingReviews.map((request) => {
          const task = data.tasks.find((item) => item.id === request.taskId);
          const member = data.members.find((item) => item.id === request.requestedBy);
          return <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-border bg-ink-base/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{task?.name ?? "Team task"}</p><p className="mt-0.5 text-xs text-slate-500">{member?.name ?? "A teammate"} · {formatDate(request.createdAt)}{request.note ? ` · ${request.note}` : ""}</p></div><div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => runMutation(() => reviewCompletionRequestAction({ requestId: request.id, approve: true }), "Task completed.")}>Approve</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => runMutation(() => reviewCompletionRequestAction({ requestId: request.id, approve: false }), "Request returned to the active task.")}>Return</Button></div></li>;
        })}</ul>
      </section>}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-white">Task board</h2><p className="mt-0.5 text-xs text-slate-500">{canManage ? "Drag cards between groups and use the handles to reorder columns." : "Your assigned tasks and team progress."}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {view === "archived" && <div className="relative"><Icon name="list" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input aria-label="Search archived tasks" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Search archived" className="!w-48 !py-2 !pl-9" /></div>}
            <div role="tablist" aria-label="Task view" className="flex rounded-xl border border-ink-border bg-ink-base p-1">
              {(["active", "completed", "archived"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${view === item ? "bg-ink-border text-white" : "text-slate-500 hover:text-slate-200"}`}>{item}<span className="ml-1.5 font-data text-[10px] text-slate-500">{item === "active" ? data.tasks.filter((task) => !task.archivedAt && (task.status === "todo" || task.status === "in_progress")).length : item === "completed" ? data.tasks.filter((task) => !task.archivedAt && task.status === "done").length : data.tasks.filter((task) => task.archivedAt).length}</span></button>)}
            </div>
          </div>
        </div>

        {view === "active" && !canManage && visibleTasks.length === 0 && <EmptyState icon="checked" title="No active tasks assigned" description="When a task is assigned to you, it will appear here." />}
        {view !== "active" && visibleTasks.length === 0 ? <EmptyState icon={view === "completed" ? "checked" : "layers"} title={view === "completed" ? "No completed tasks yet" : "No archived tasks found"} description={view === "completed" ? "Completed team tasks will be collected here." : archiveSearch ? "Try a different search." : "Archived tasks stay available here for reference."} /> : (
          <DndContext
            id="team-task-workspace-board"
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={(event) => {
              if (event.active.data.current?.kind === "task") setDraggingTask(data.tasks.find((task) => task.id === event.active.data.current?.taskId) ?? null);
            }}
            onDragCancel={() => setDraggingTask(null)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex max-w-full items-start gap-3 overflow-x-auto pb-5">
              <div className="sticky left-0 z-20 shrink-0 self-start"><TeamTaskColumn group={null} tasks={columns[0].tasks} allTasks={data.tasks} now={now} view={view} members={data.members} canManage={canManage} collapsed={false} glowingTaskId={glowingTaskId} onToggleCollapse={() => undefined} onDeleteGroup={() => undefined} onOpenTask={openTask} onStartTask={(task) => runMutation(() => setTeamTaskStatusAction({ taskId: task.id, status: "in_progress" }), "Work started.")} onCompleteTask={(task) => runMutation(() => setTeamTaskStatusAction({ taskId: task.id, status: "done" }), "Task completed.")} /></div>
              <SortableContext items={data.groups.map((group) => `group:${group.id}`)} strategy={horizontalListSortingStrategy}>
                {columns.slice(1).map(({ group, tasks }) => group && <TeamTaskColumn key={group.id} group={group} tasks={tasks} allTasks={data.tasks} now={now} view={view} members={data.members} canManage={canManage} collapsed={collapsedGroups.has(group.id)} glowingTaskId={glowingTaskId} onToggleCollapse={() => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })} onDeleteGroup={deleteGroup} onOpenTask={openTask} onStartTask={(task) => runMutation(() => setTeamTaskStatusAction({ taskId: task.id, status: "in_progress" }), "Work started.")} onCompleteTask={(task) => runMutation(() => setTeamTaskStatusAction({ taskId: task.id, status: "done" }), "Task completed.")} />)}
              </SortableContext>
            </div>
            <DragOverlay>{draggingTask && <div className="w-72 rotate-1 rounded-xl border border-theme-accent/60 bg-ink-card p-3 text-sm font-semibold text-white shadow-xl">{draggingTask.name}</div>}</DragOverlay>
          </DndContext>
        )}
      </section>

      <TeamTaskCreateDialog key={team.id} open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} teamId={team.id} groups={data.groups} members={data.members} userId={userId} />
      <TeamGroupCreateDialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} teamId={team.id} />
      <Dialog open={selectedTask !== null} onClose={closeTask} title={selectedTask?.name ?? "Task details"} description={selectedTask ? `${statusLabel(selectedTask)} · ${DIFFICULTY_LABELS[selectedTask.difficulty]}${selectedTask.dueAt ? ` · Due ${formatDate(selectedTask.dueAt)}` : ""}` : undefined} maxWidth="max-w-3xl">
        {selectedTask && <div className="space-y-5">
          <div className="grid gap-3 rounded-2xl border border-ink-border bg-ink-base/50 p-4 sm:grid-cols-3">
            <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Created</p><p className="mt-1 text-sm text-slate-200">{formatDate(selectedTask.createdAt)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Started</p><p className="mt-1 text-sm text-slate-200">{selectedTask.startedAt ? formatDate(selectedTask.startedAt) : "Not started"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Completed</p><p className="mt-1 text-sm text-slate-200">{selectedTask.completedAt ? formatDate(selectedTask.completedAt) : "—"}</p></div>
            <div className="sm:col-span-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Assigned members</p><div className="mt-2 flex flex-wrap gap-2">{selectedTask.assigneeIds.length ? selectedTask.assigneeIds.map((id) => { const member = data.members.find((item) => item.id === id); return <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-border px-2 py-1 text-xs text-slate-300"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-border font-data text-[9px]">{initials(member?.name ?? null, id)}</span>{member?.name ?? "Former teammate"}</span>; }) : <span className="text-sm text-slate-500">No assigned members.</span>}</div></div>
            {selectedTask.description && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300 sm:col-span-3">{selectedTask.description}</p>}
          </div>

          {canManage && !editingTask && <div className="flex flex-wrap gap-2">
            {!selectedTask.archivedAt && selectedTask.status === "done" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => runMutation(() => setTeamTaskStatusAction({ taskId: selectedTask.id, status: "in_progress" }), "Task reopened.")}>Reopen task</Button>}
            {!selectedTask.archivedAt && <Button size="sm" variant="ghost" disabled={pending} onClick={() => runMutation(() => archiveTeamTaskAction({ taskId: selectedTask.id, archived: true }), "Task archived.")}>Archive</Button>}
            {selectedTask.archivedAt && <Button size="sm" variant="secondary" disabled={pending} onClick={() => runMutation(() => archiveTeamTaskAction({ taskId: selectedTask.id, archived: false }), "Task restored.")}>Restore to {selectedTask.status === "done" ? "Completed" : "Active"}</Button>}
            {!selectedTask.archivedAt && <Button size="sm" variant="ghost" onClick={() => setEditingTask(true)}>Edit task</Button>}
          </div>}

          {canManage && editingTask && <TeamTaskEditForm teamId={team.id} task={selectedTask} groups={data.groups} members={data.members} onCancel={() => setEditingTask(false)} />}

          {selectedTask.status === "todo" && selectedTaskIsAssigned && !selectedTask.archivedAt && <Button size="sm" variant="secondary" disabled={pending} onClick={() => runMutation(() => setTeamTaskStatusAction({ taskId: selectedTask.id, status: "in_progress" }), "Work started.")}>Start work</Button>}
          {selectedTask.status === "in_progress" && selectedTaskIsAssigned && !selectedTask.archivedAt && selectedTask.latestRequest?.status !== "pending" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => runMutation(() => submitCompletionRequestAction({ taskId: selectedTask.id }), "Completion request sent for review.")}>Request completion</Button>}
          {selectedTask.latestRequest?.status === "pending" && selectedTask.latestRequest.requestedBy === userId && <Button size="sm" variant="ghost" disabled={pending} onClick={() => runMutation(() => cancelCompletionRequestAction({ requestId: selectedTask.latestRequest!.id }), "Completion request cancelled.")}>Cancel completion request</Button>}

          <section className="space-y-3 border-t border-ink-border pt-4">
            <div><h3 className="font-display font-bold text-white">Need help</h3><p className="mt-0.5 text-xs text-slate-500">Help requests stay separate from the task’s progress.</p></div>
            {activeRequests.length > 0 ? <div className="space-y-2">{activeRequests.map((request) => <HelpRequestRow key={request.id} request={request} userId={userId} canResolve={selectedTaskIsAssigned || canManage} onResolve={() => runMutation(() => updateTeamTaskHelpAction({ requestId: request.id, resolve: true }), "Help request resolved.")} onCancel={() => runMutation(() => updateTeamTaskHelpAction({ requestId: request.id, resolve: false }), "Help request cancelled.")} />)}</div> : <p className="rounded-xl border border-dashed border-ink-border p-3 text-sm text-slate-500">No one has an active help request for this task.</p>}
            {selectedTaskIsAssigned && !selectedTaskOwnRequest && !selectedTask.archivedAt && selectedTask.status !== "done" && <form onSubmit={submitHelp} className="space-y-2"><Field label="Ask your team"><Textarea value={helpMessage} onChange={(event) => setHelpMessage(event.target.value)} maxLength={500} rows={2} placeholder="What are you blocked on? (optional)" /></Field><Button size="sm" type="submit" loading={pending}>Need help</Button></form>}
            {selectedTaskOwnRequest && <p className="rounded-lg border border-theme-accent/20 bg-theme-accent/[0.06] px-3 py-2 text-xs text-theme-accent">Your help request is active. You can cancel it above if the issue is resolved.</p>}
            {selectedTask.helpRequests.some((request) => request.status !== "open") && <details className="rounded-xl border border-ink-border p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-400">Help request history</summary><div className="mt-3 space-y-2">{selectedTask.helpRequests.filter((request) => request.status !== "open").map((request) => <HelpRequestRow key={request.id} request={request} userId={userId} canResolve={false} onResolve={() => undefined} onCancel={() => undefined} />)}</div></details>}
          </section>
        </div>}
      </Dialog>
    </div>
  );
}
