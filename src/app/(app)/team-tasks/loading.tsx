import { TeamTaskColumnSkeleton } from "@/features/team-tasks/components/TeamTaskSkeletons";

export default function TeamTasksLoading() {
  return (
    <div className="relative min-h-screen -mx-4 -my-4 sm:-mx-6 sm:-my-6 p-4 sm:p-6 space-y-6">
      {/* Top subtle radial gradient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgb(var(--theme-rgb)/0.1),transparent_70%)]"
        aria-hidden="true"
      />

      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-border pb-5">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-ink-border" />
          <div className="h-7 w-44 rounded bg-ink-border/80" />
          <div className="h-4 w-32 rounded bg-ink-border/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-xl bg-ink-border" />
          <div className="h-9 w-32 rounded-xl bg-ink-border/80" />
        </div>
      </div>

      {/* Stats header card skeleton */}
      <div className="h-48 rounded-2xl border border-ink-border bg-ink-surface/60 p-6" />

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-9 w-48 rounded-xl bg-ink-border" />
          <div className="h-9 w-24 rounded-xl bg-ink-border" />
          <div className="h-9 w-44 rounded-xl bg-ink-border" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-ink-border/80" />
      </div>

      {/* Column skeletons */}
      <div className="flex items-start gap-4 overflow-hidden pt-2">
        <TeamTaskColumnSkeleton />
        <TeamTaskColumnSkeleton />
        <TeamTaskColumnSkeleton />
        <TeamTaskColumnSkeleton />
      </div>
    </div>
  );
}
