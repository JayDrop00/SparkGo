import Skeleton from "@/components/ui/Skeleton";

const card = "hud-card rounded-2xl p-4";

export default function DashboardLoading() {
  return (
    <section aria-label="Loading dashboard" aria-busy="true" className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading task statistics">
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index} className={card}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-9 w-16" />
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-24" />
          <div className="divide-y divide-ink-border">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-3 w-32 max-w-full" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </article>
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-28" />
          <div className="flex gap-8">
            <div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-16" /></div>
            <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-9 w-12" /></div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <div className="mb-2 flex justify-between gap-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-12" /></div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </article>
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-24" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="space-y-2 rounded-lg bg-ink-base/60 px-1 py-2">
                <Skeleton className="mx-auto h-3 w-7" />
                <Skeleton className="mx-auto h-3 w-4" />
                <Skeleton className="mx-auto h-2 w-5 rounded-full" />
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className={card}>
        <Skeleton className="mb-2 h-5 w-24" />
        <Skeleton className="mb-3 h-4 w-80 max-w-full" />
        <div className="flex gap-2"><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
      </article>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-36" />
          <div className="flex h-28 items-end gap-2">
            {["h-10", "h-16", "h-12", "h-24", "h-14", "h-20", "h-11"].map((height, index) => <Skeleton key={index} className={`flex-1 rounded-t ${height}`} />)}
          </div>
        </article>
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex justify-between gap-3"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-4 w-20" /></div>)}</div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 border-b border-ink-border/70 pb-2">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </article>
        <article className={card}>
          <Skeleton className="mb-4 h-5 w-44" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between gap-3"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-10" /></div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
