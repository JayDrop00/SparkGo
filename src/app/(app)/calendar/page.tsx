import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import CalendarView from "@/features/calendar/components/CalendarView";
import { getBoard } from "@/features/grouped-personal-task/services/group.service";
import { getClaimsCached } from "@/features/auth/services/session.service";

export const metadata: Metadata = {
  title: "Calendar — SparkGo",
};

export const instant = false;

export default async function CalendarPage() {
  await connection();
  const claims = await getClaimsCached();
  if (!claims) redirect("/auth?mode=login&next=/calendar");

  const board = await getBoard(claims.sub as string);
  const tasks = [
    ...board.groups.flatMap((group) => [...group.tasks, ...group.completedTasks]),
    ...board.ungrouped,
    ...board.ungroupedCompleted,
  ];
  return <CalendarView initialTasks={tasks} groups={board.groups} />;
}
