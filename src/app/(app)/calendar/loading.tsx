import Skeleton from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-8 text-center">
      <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
      <Skeleton className="mx-auto h-7 w-72 max-w-full" />
      <Skeleton className="mx-auto h-4 w-96 max-w-full" />
    </div>
  );
}
