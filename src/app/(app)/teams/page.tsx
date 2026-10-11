import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import TeamWorkspace from "@/features/teams/components/TeamWorkspace";
import { getTeamPageData } from "@/features/teams/services/team.service";

// Session-gated shell above reads cookies: render per-request.
export const instant = false;

export const metadata: Metadata = {
  title: "MyTeam — SparkGo",
};

export default async function TeamsPage({ searchParams }: {
  searchParams: Promise<{ team?: string; tab?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=/teams");

  let data;
  try {
    data = await getTeamPageData(supabase, user.id, params.team);
  } catch {
    return <EmptyState icon="users" title="Team data unavailable" description="Refresh the page. If this keeps happening, check your team access and database connection." />;
  }
  return <TeamWorkspace data={data} userId={user.id} initialTab={params.tab} />;
}
