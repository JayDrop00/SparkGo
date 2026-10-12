import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import TeamTaskBoard from "@/features/team-tasks/components/TeamTaskBoard";
import { getTeamTaskPageData } from "@/features/team-tasks/services/team-task.service";
import { createClient } from "@/lib/supabase/server";
import TeamTasksLoading from "./loading";

export const instant = false;
export const metadata: Metadata = { title: "Team Task — SparkGo" };

function getRequestTime() {
  return Date.now();
}

async function TeamTasksContent({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  await connection();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=/team-tasks");
  const data = await getTeamTaskPageData(supabase, user.id, params.team);
  return <TeamTaskBoard data={data} userId={user.id} now={getRequestTime()} />;
}

export default function TeamTasksPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  return (
    <Suspense fallback={<TeamTasksLoading />}>
      <TeamTasksContent searchParams={searchParams} />
    </Suspense>
  );
}
