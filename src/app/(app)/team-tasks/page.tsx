import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TeamTaskBoard from "@/features/team-tasks/components/TeamTaskBoard";
import { getTeamTaskPageData } from "@/features/team-tasks/services/team-task.service";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Team Task — SparkGo" };

export default async function TeamTasksPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=/team-tasks");
  const data = await getTeamTaskPageData(supabase, user.id, params.team);
  return <TeamTaskBoard data={data} userId={user.id} />;
}
