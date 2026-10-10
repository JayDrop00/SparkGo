import Skeleton from "@/components/ui/Skeleton";

export default function TasksLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex items-start gap-4 overflow-hidden">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="hud-card w-72 shrink-0 space-y-3 rounded-3xl p-4 sm:w-80"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-6" />
            </div>
            {[0, 1, 3].map((row) => (
              <div key={row} className="space-y-2 rounded-2xl border border-ink-border/70 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
