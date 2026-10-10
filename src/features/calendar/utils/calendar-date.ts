export type CalendarView = "day" | "week" | "month";

export const SLOT_MINUTES = 30;
export const SLOT_HEIGHT = 24;

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfWeek(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

export function getVisibleDates(date: Date, view: CalendarView): Date[] {
  if (view === "day") return [new Date(date.getFullYear(), date.getMonth(), date.getDate())];
  if (view === "week") {
    const first = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }
  const firstMonthDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const first = startOfWeek(firstMonthDay);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function atLocalTime(date: Date, minutes: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setMinutes(minutes);
  return result;
}

export function moveByView(date: Date, view: CalendarView, direction: -1 | 1): Date {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addDays(date, 7 * direction);
  return addMonths(date, direction);
}

export function formatRange(date: Date, view: CalendarView): string {
  const options: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
  if (view === "day") return new Intl.DateTimeFormat(undefined, { ...options, day: "numeric", weekday: "long" }).format(date);
  if (view === "month") return new Intl.DateTimeFormat(undefined, options).format(date);
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  const sameMonth = first.getMonth() === last.getMonth();
  const left = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(first);
  const right = new Intl.DateTimeFormat(undefined, { month: sameMonth ? undefined : "short", day: "numeric", year: "numeric" }).format(last);
  return `${left} – ${right}`;
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
