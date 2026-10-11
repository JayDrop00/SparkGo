export type DashboardScope = "personal" | "team" | "all";
export type DashboardData = {
  scope: DashboardScope;
  timezone: string;
  stats: { due_today: number; overdue: number; completed_this_week: number; active: number };
  upNext: { id: string; source: string; team_id: string | null; team_name: string | null; title: string; due_at: string | null; difficulty: string; group_name: string | null; group_color: string | null; status: string }[];
  groups: { source: string; team_id: string | null; group_id: string; name: string; color: string | null; done_count: number; total_count: number }[];
  week: { day: string; group_colors: string[] }[];
  trend: { day: string; completions: number }[];
  spark: { points_this_week: number; streak_days: number };
  pendingRequests: { id: string; team_id: string; task_id: string; requested_by: string; note: string | null; created_at: string }[];
  workload: { user_id: string; display_name: string | null; open_task_count: number; tags: string[] }[];
  activity: { activity_id: number; action: string }[];
  managedTeamName: string | null;
  managedTeams: { id: string; name: string }[];
  managedTeamId: string | null;
  errors: string[];
};
