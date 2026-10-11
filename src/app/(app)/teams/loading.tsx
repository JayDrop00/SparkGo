import Skeleton from "@/components/ui/Skeleton";

export default function TeamsLoading() {
  return (
    <section aria-label="Loading team workspace" aria-busy="true" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </header>

      <nav aria-label="Loading team sections" className="mb-5 flex flex-wrap gap-2 border-b border-ink-border pb-3">
        {["w-20", "w-24", "w-14", "w-20"].map((width, index) => (
          <Skeleton key={index} className={`h-9 rounded-xl ${width}`} />
        ))}
      </nav>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card/40">
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_3rem] gap-4 border-b border-ink-border px-4 py-3 sm:grid">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <span />
          </div>
          <ul className="divide-y divide-ink-border/70">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_3rem] sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    {index === 0 && <Skeleton className="h-3 w-20" />}
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <div className="flex justify-end"><Skeleton className="h-8 w-8 rounded-lg" /></div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}
