import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DashboardData, DashboardScope } from "../dto/dashboard.dto";

type Client = SupabaseClient<Database>;
function mondayForTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const localDate = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

export async function getDashboardData(client: Client, userId: string, scope: DashboardScope, timezone: string, requestedManagedTeamId?: string): Promise<DashboardData> {
  const errors: string[] = [];
  const { data: memberships, error: membershipError } = await client.from("team_members").select("team_id, role").eq("user_id", userId);
  if (membershipError) throw membershipError;
  const managerMemberships = memberships.filter((item) => item.role === "admin" || item.role === "manager");
  const { data: managedRows, error: managedError } = managerMemberships.length
    ? await client.from("teams").select("id,name").in("id", managerMemberships.map((item) => item.team_id)).order("name")
    : { data: [], error: null };
  if (managedError) errors.push("managed-teams");
  const managedTeams = (managedRows ?? []).map((row) => ({ id: row.id, name: row.name }));
  const manager = managerMemberships.find((item) => item.team_id === requestedManagedTeamId) ?? managerMemberships[0];
  const managedTeamId = manager?.team_id ?? null;
  const managedTeamName = managedTeams.find((team) => team.id === managedTeamId)?.name ?? null;
  const weekStart = mondayForTimezone(timezone);
  const safe = async <T>(key: string, query: PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: T): Promise<T> => {
    const { data, error } = await query;
    if (error) { errors.push(key); return fallback; }
    return data ?? fallback;
  };
  const [stats, upNext, groups, week, trend, spark, pendingRequests, workload, activity] = await Promise.all([
    safe("stats", client.rpc("dashboard_stats", { p_scope: scope, p_tz: timezone }), []),
    safe("up-next", client.rpc("dashboard_up_next", { p_scope: scope, p_tz: timezone, p_limit: 5 }), []),
    safe("group-progress", client.rpc("dashboard_group_progress", { p_scope: scope }), []),
    safe("week", client.rpc("dashboard_week", { p_scope: scope, p_tz: timezone, p_week_start: weekStart }), []),
    safe("trend", client.rpc("dashboard_trend", { p_scope: scope, p_tz: timezone, p_days: 7 }), []),
    safe("spark", client.rpc("dashboard_spark", { p_scope: scope, p_tz: timezone }), []),
    safe("review-queue", client.from("completion_requests").select("id, team_id, task_id, requested_by, note, created_at").eq("status", "pending").order("created_at", { ascending: true }), []),
    manager ? safe("workload", client.rpc("team_workload", { p_team_id: manager.team_id }), []) : Promise.resolve([]),
    manager ? safe("activity", client.rpc("team_activity_recent", { p_team_id: manager.team_id, p_limit: 8 }), []) : Promise.resolve([]),
  ]);
  return {
    scope, timezone,
    stats: stats[0] ?? { due_today: 0, overdue: 0, completed_this_week: 0, active: 0 },
    upNext: upNext as DashboardData["upNext"], groups: groups as DashboardData["groups"], week: week as DashboardData["week"], trend: trend as DashboardData["trend"],
    spark: spark[0] ?? { points_this_week: 0, streak_days: 0 },
    pendingRequests: pendingRequests as DashboardData["pendingRequests"],
    workload: workload as DashboardData["workload"], activity: activity as DashboardData["activity"],
    managedTeamName, managedTeams, managedTeamId, errors,
  };
}
