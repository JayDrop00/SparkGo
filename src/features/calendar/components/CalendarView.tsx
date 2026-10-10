"use client";

import { useMemo, useState, type SetStateAction } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import type { GroupResponseDto } from "@/features/grouped-personal-task/dto/group-response.dto";
import { rescheduleTaskAction, setTaskCompletedAction } from "@/features/tasks/actions/task.actions";
import {
  atLocalTime,
  dateKey,
  formatRange,
  getVisibleDates,
  moveByView,
  parseDateKey,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  type CalendarView,
} from "../utils/calendar-date";

type Props = {
  initialTasks: TaskResponseDto[];
  groups: GroupResponseDto[];
};

const HOUR_HEIGHT = SLOT_HEIGHT * (60 / SLOT_MINUTES);
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => hour);
const VIEWS: Array<{ key: CalendarView; label: string }> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// Draggable task cards are also registered as droppable rectangles by dnd-kit.
// Restrict collisions to real calendar/list targets so drops over an existing
// task still resolve to the time slot underneath it.
const calendarCollisionDetection: CollisionDetection = (args) =>
  pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ id }) => {
      const target = String(id);
      return target === "unscheduled" || target.startsWith("slot:") || target.startsWith("date:");
    }),
  });

function sameLocalDay(timestamp: string, date: Date): boolean {
  const value = new Date(timestamp);
  return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth() && value.getDate() === date.getDate();
}

function localTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function scheduledLength(task: TaskResponseDto): number {
  if (!task.startAt || !task.endAt) return 60;
  return Math.max(SLOT_MINUTES, (new Date(task.endAt).getTime() - new Date(task.startAt).getTime()) / 60_000);
}

function taskListVersion(tasks: TaskResponseDto[]): string {
  return tasks
    .map((task) => `${task.id}:${task.updatedAt}:${task.startAt}:${task.endAt}:${task.completedAt}`)
    .join("|");
}

function TaskCard({ task, compact = false, fillDuration = false, onEdit, onComplete }: {
  task: TaskResponseDto;
  compact?: boolean;
  fillDuration?: boolean;
  onEdit: (task: TaskResponseDto) => void;
  onComplete: (task: TaskResponseDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative z-10 overflow-hidden rounded-lg border border-theme-accent/50 bg-theme-accent/15 px-2 py-1 text-left shadow-md ${fillDuration ? "h-full" : ""} ${isDragging ? "opacity-35" : ""} ${task.completedAt ? "opacity-60" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <button type="button" aria-label={task.completedAt ? "Mark task active" : "Mark task complete"} onClick={(event) => { event.stopPropagation(); onComplete(task); }} className="mt-0.5 shrink-0 text-theme-accent">
          <Icon name={task.completedAt ? "checked" : "unchecked"} className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(task); }} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-xs font-semibold ${task.completedAt ? "line-through text-slate-400" : "text-white"}`}>{task.taskName}</span>
          {!compact && task.startAt && task.endAt && <span className="block truncate font-data text-[10px] text-slate-400">{localTime(task.startAt)}–{localTime(task.endAt)}</span>}
        </button>
      </div>
    </div>
  );
}

function TimeSlot({ date, minutes }: { date: Date; minutes: number }) {
  const id = `slot:${dateKey(date)}:${minutes}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { dateKey: dateKey(date), minutes } });
  return <div ref={setNodeRef} className={`h-6 border-t border-ink-border/50 ${isOver ? "bg-theme-accent/15" : ""}`} />;
}

function MonthDateCell({ date, activeMonth, activeYear, tasks, onEdit, onComplete }: {
  date: Date;
  activeMonth: number;
  activeYear: number;
  tasks: TaskResponseDto[];
  onEdit: (task: TaskResponseDto) => void;
  onComplete: (task: TaskResponseDto) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `date:${dateKey(date)}`, data: { dateKey: dateKey(date), minutes: null } });
  return (
    <div ref={setNodeRef} className={`min-h-28 border-b border-r border-ink-border/70 p-1.5 ${date.getMonth() !== activeMonth || date.getFullYear() !== activeYear ? "bg-ink-base/40 text-slate-600" : ""} ${isOver ? "bg-theme-accent/10" : ""}`}>
      <div className={`mb-1 text-right font-data text-xs ${dateKey(date) === dateKey(new Date()) ? "font-bold text-theme-accent" : "text-slate-400"}`}>{date.getDate()}</div>
      <div className="space-y-1">
        {tasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} compact onEdit={onEdit} onComplete={onComplete} />)}
        {tasks.length > 4 && <span className="pl-1 text-[10px] text-slate-500">+{tasks.length - 4} more</span>}
      </div>
    </div>
  );
}

export default function CalendarView({ initialTasks, groups }: Props) {
  const toast = useToast();
  const serverTasks = initialTasks.filter((task) => task.completedAt === null);
  const serverVersion = taskListVersion(initialTasks);
  const [taskState, setTaskState] = useState(() => ({ version: serverVersion, tasks: serverTasks }));
  const tasks = taskState.version === serverVersion ? taskState.tasks : serverTasks;
  const setTasks = (update: SetStateAction<TaskResponseDto[]>) => {
    setTaskState((current) => {
      const base = current.version === serverVersion ? current.tasks : serverTasks;
      return {
        version: serverVersion,
        tasks: typeof update === "function" ? update(base) : update,
      };
    });
  };
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("day");
  const [activeTask, setActiveTask] = useState<TaskResponseDto | null>(null);
  const [editingTask, setEditingTask] = useState<TaskResponseDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const visibleDates = useMemo(() => getVisibleDates(selectedDate, view), [selectedDate, view]);
  const scheduledTasks = tasks.filter((task) => task.startAt && task.endAt);
  const unscheduledTasks = tasks.filter((task) => !task.startAt || !task.endAt);
  const groupsForForm = groups.map(({ id, groupName }) => ({ id, groupName }));

  async function saveSchedule(task: TaskResponseDto, start: Date | null, end: Date | null) {
    const previous = tasks;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, startAt: start?.toISOString() ?? null, endAt: end?.toISOString() ?? null } : item));
    const result = await rescheduleTaskAction({ taskId: task.id, startAt: start?.toISOString() ?? null, endAt: end?.toISOString() ?? null });
    if (result.ok) {
      setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
      toast.success(start ? "Task rescheduled." : "Task moved to unscheduled.");
    } else {
      setTasks(previous);
      toast.error(result.error.message);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    if (!event.over) return;
    const task = tasks.find((item) => item.id === String(event.active.id));
    if (!task) return;
    if (event.over.id === "unscheduled") {
      if (task.startAt) await saveSchedule(task, null, null);
      return;
    }
    const target = event.over.data.current as { dateKey?: string; minutes?: number | null } | undefined;
    if (!target?.dateKey) return;
    const date = parseDateKey(target.dateKey);
    const minutes = target.minutes ?? (task.startAt ? new Date(task.startAt).getHours() * 60 + new Date(task.startAt).getMinutes() : 9 * 60);
    const start = atLocalTime(date, minutes);
    const end = new Date(start.getTime() + scheduledLength(task) * 60_000);
    await saveSchedule(task, start, end);
  }

  async function completeTask(task: TaskResponseDto) {
    const completed = task.completedAt === null;
    const result = await setTaskCompletedAction({ taskId: task.id, completed });
    if (result.ok) {
      if (completed) setTasks((current) => current.filter((item) => item.id !== task.id));
      else setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
    }
    else toast.error(result.error.message);
  }

  function resizeStart(event: React.PointerEvent<HTMLSpanElement>, task: TaskResponseDto) {
    if (!task.startAt || !task.endAt) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const originalEnd = new Date(task.endAt);
    const pointerUp = (up: PointerEvent) => {
      const minutes = Math.round(((up.clientY - startY) / HOUR_HEIGHT) * 60 / SLOT_MINUTES) * SLOT_MINUTES;
      if (minutes) {
        const end = new Date(originalEnd.getTime() + minutes * 60_000);
        if (end > new Date(task.startAt!)) void saveSchedule(task, new Date(task.startAt!), end);
      }
      window.removeEventListener("pointerup", pointerUp);
    };
    window.addEventListener("pointerup", pointerUp, { once: true });
  }

  function slotCard(task: TaskResponseDto, date: Date) {
    if (!task.startAt || !sameLocalDay(task.startAt, date)) return null;
    const start = new Date(task.startAt);
    const minutes = start.getHours() * 60 + start.getMinutes();
    const duration = scheduledLength(task);
    return (
      <div key={task.id} className="absolute left-1 right-1" style={{ top: minutes * (SLOT_HEIGHT / SLOT_MINUTES), height: Math.max(32, duration * (SLOT_HEIGHT / SLOT_MINUTES)) }}>
        <TaskCard task={task} fillDuration onEdit={(item) => { setEditingTask(item); setFormOpen(true); }} onComplete={completeTask} />
        <span onPointerDown={(event) => resizeStart(event, task)} className="absolute inset-x-2 bottom-0 z-20 h-2 cursor-ns-resize rounded-b bg-theme-accent/30" aria-label="Resize task duration" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={calendarCollisionDetection} onDragStart={(event) => setActiveTask(tasks.find((task) => task.id === String(event.active.id)) ?? null)} onDragEnd={handleDragEnd}>
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-data text-xs uppercase tracking-[0.24em] text-theme-accent">Calendar</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{formatRange(selectedDate, view)}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedDate(new Date())}>Today</Button>
            <div className="flex items-center rounded-xl border border-ink-border bg-ink-card/70 p-0.5">
              <button type="button" aria-label="Previous" onClick={() => setSelectedDate((date) => moveByView(date, view, -1))} className="rounded-lg p-2 text-slate-300 hover:bg-ink-border hover:text-white">‹</button>
              <button type="button" aria-label="Next" onClick={() => setSelectedDate((date) => moveByView(date, view, 1))} className="rounded-lg p-2 text-slate-300 hover:bg-ink-border hover:text-white">›</button>
            </div>
            <select aria-label="Calendar view" value={view} onChange={(event) => setView(event.target.value as CalendarView)} className="rounded-xl border border-ink-border bg-ink-card px-3 py-2 text-sm text-white outline-none focus:border-theme-accent">
              {VIEWS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <Button size="sm" onClick={() => { setEditingTask(null); setFormOpen(true); }}><Icon name="plus" className="h-4 w-4" /> New task</Button>
          </div>
        </header>

        <UnscheduledList tasks={unscheduledTasks} onEdit={(task) => { setEditingTask(task); setFormOpen(true); }} onComplete={completeTask} />

        {view === "month" ? (
          <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface/80">
            <div className="grid grid-cols-7 border-b border-ink-border text-center font-data text-xs uppercase text-slate-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-3">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {visibleDates.map((date) => <MonthDateCell key={dateKey(date)} date={date} activeMonth={selectedDate.getMonth()} activeYear={selectedDate.getFullYear()} tasks={scheduledTasks.filter((task) => task.startAt && sameLocalDay(task.startAt, date))} onEdit={(task) => { setEditingTask(task); setFormOpen(true); }} onComplete={completeTask} />)}
            </div>
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-ink-border bg-ink-surface/80">
            <div className="min-w-[760px]">
              <div className="sticky top-0 z-30 grid border-b border-ink-border bg-ink-surface" style={{ gridTemplateColumns: `64px repeat(${visibleDates.length}, minmax(100px, 1fr))` }}>
                <div />
                {visibleDates.map((date) => <div key={dateKey(date)} className="border-l border-ink-border/70 px-2 py-3 text-center">
                  <div className="font-data text-xs uppercase text-slate-500">{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)}</div>
                  <div className={`mt-1 font-display text-lg font-bold ${dateKey(date) === dateKey(new Date()) ? "text-theme-accent" : "text-white"}`}>{date.getDate()}</div>
                </div>)}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `64px repeat(${visibleDates.length}, minmax(100px, 1fr))` }}>
                <div>{HOUR_LABELS.map((hour) => <div key={hour} className="h-12 pr-2 text-right font-data text-[10px] text-slate-500">{hour === 0 ? "" : new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2000, 0, 1, hour))}</div>)}</div>
                {visibleDates.map((date) => <div key={dateKey(date)} className="relative border-l border-ink-border/70" style={{ height: 24 * HOUR_HEIGHT }}>
                  <div className="relative z-0">{Array.from({ length: 48 }, (_, index) => <TimeSlot key={index} date={date} minutes={index * SLOT_MINUTES} />)}</div>
                  {scheduledTasks.map((task) => slotCard(task, date))}
                </div>)}
              </div>
            </div>
          </div>
        )}

        <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} groups={groupsForForm} task={editingTask} onSaved={(task) => setTasks((current) => current.some((item) => item.id === task.id) ? current.map((item) => item.id === task.id ? task : item) : [task, ...current])} />
      </section>
      <DragOverlay>
        {activeTask && (
          <div
            className="flex max-w-64 flex-col overflow-hidden rounded-lg border-2 border-theme-accent bg-theme-accent/25 p-2 text-sm font-semibold text-white shadow-[0_0_28px_rgb(var(--theme-rgb)/0.35)]"
            style={{ height: Math.max(48, scheduledLength(activeTask) * (SLOT_HEIGHT / SLOT_MINUTES)) }}
          >
            <span className="truncate">{activeTask.taskName}</span>
            <span className="mt-1 font-data text-[10px] text-slate-200">
              {activeTask.startAt ? `${localTime(activeTask.startAt)} · ` : ""}{scheduledLength(activeTask)} min
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function UnscheduledList({ tasks, onEdit, onComplete }: { tasks: TaskResponseDto[]; onEdit: (task: TaskResponseDto) => void; onComplete: (task: TaskResponseDto) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <section ref={setNodeRef} className={`rounded-2xl border border-ink-border bg-ink-surface/70 p-4 ${isOver ? "border-theme-accent bg-theme-accent/5" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="font-display text-sm font-bold text-white">Unscheduled</h2><p className="mt-0.5 text-xs text-slate-500">Drag a task onto a date and time.</p></div>
        <span className="rounded-full bg-ink-card px-2.5 py-1 font-data text-xs text-slate-400">{tasks.length}</span>
      </div>
      {tasks.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tasks.map((task) => <TaskCard key={task.id} task={task} onEdit={onEdit} onComplete={onComplete} />)}</div> : <p className="text-sm text-slate-500">All tasks have a scheduled time.</p>}
    </section>
  );
}
