import type { Metadata } from "next";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardOverview from "@/features/dashboard/components/DashboardOverview";
import TimezoneCookie from "@/features/dashboard/components/TimezoneCookie";
import type { DashboardScope } from "@/features/dashboard/dto/dashboard.dto";
import { getDashboardData } from "@/features/dashboard/queries/dashboard.query";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard — SparkGo" };
export const instant = false;

function validTimezone(value: string | undefined): string {
  if (!value) return "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value; }
  catch { return "UTC"; }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ scope?: string; team?: string }> }) {
  await connection();
  const params = await searchParams;
  const scope: DashboardScope = params.scope === "personal" || params.scope === "team" ? params.scope : "all";
  const timezone = validTimezone((await cookies()).get("tz")?.value);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login&next=/dashboard");
  const data = await getDashboardData(supabase, user.id, scope, timezone, params.team);
  return <section className="mx-auto w-full max-w-6xl"><TimezoneCookie /><DashboardOverview data={data} userId={user.id} /></section>;
}
