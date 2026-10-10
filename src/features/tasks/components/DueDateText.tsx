import Badge from "@/components/ui/Badge";

type Props = {
  dueDate: string | null;
  className?: string;
};

function isPast(dueDate: Date): boolean {
  return dueDate.getTime() < Date.now();
}

function isToday(dueDate: Date): boolean {
  const now = new Date();
  return (
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate()
  );
}

export default function DueDateText({ dueDate, className = "" }: Props) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;

  const label = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const past = isPast(date);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`font-data text-xs ${past ? "text-red-300" : "text-slate-400"}`}>
        {label}
      </span>
      {past && <Badge tone="danger">Overdue</Badge>}
      {!past && isToday(date) && <Badge tone="warning">Due today</Badge>}
    </span>
  );
}
