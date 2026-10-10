import Skeleton from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-5">
      <Skeleton className="h-6 w-28 rounded-full" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="hud-card mt-8 max-w-xl space-y-3 rounded-3xl p-6 sm:p-8">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-9 w-28" />
    </section>
  );
}
