import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TeamResponseDto } from "@/features/teams/dto/team-response.dto";
import type { CompletionRequestDto, TeamTaskDto, TeamTaskGroupDto, TeamTaskHelpRequestDto, TeamTaskMemberDto } from "../dto/team-task.dto";

type Client = SupabaseClient<Database>;
export type TeamTaskPageData = {
  teams: TeamResponseDto[];
  team: TeamResponseDto | null;
  invalidTeam: boolean;
  members: TeamTaskMemberDto[];
  groups: TeamTaskGroupDto[];
  tasks: TeamTaskDto[];
  requests: CompletionRequestDto[];
  helpRequests: TeamTaskHelpRequestDto[];
};

export async function getTeamTaskPageData(client: Client, userId: string, teamId?: string): Promise<TeamTaskPageData> {
  const { data: memberships, error: membershipError } = await client.from("team_members").select("team_id, role").eq("user_id", userId);
  if (membershipError) throw membershipError;
  const ids = memberships.map((item) => item.team_id);
  const { data: teamRows, error: teamError } = ids.length
    ? await client.from("teams").select("id, name, owner_id").in("id", ids).order("name")
    : { data: [], error: null };
  if (teamError) throw teamError;
  const teams: TeamResponseDto[] = teamRows.flatMap((row) => {
    const membership = memberships.find((entry) => entry.team_id === row.id);
    return membership ? [{ id: row.id, name: row.name, ownerId: row.owner_id, role: membership.role }] : [];
  });
  const team = teamId ? teams.find((item) => item.id === teamId) ?? null : teams[0] ?? null;
  const invalidTeam = Boolean(teamId && !team);
  if (!team) return { teams, team: null, invalidTeam, members: [], groups: [], tasks: [], requests: [], helpRequests: [] };

  const [memberRows, groupRows, taskRows, assignmentRows, requestRows, helpRows] = await Promise.all([
    client.from("team_members").select("user_id, role").eq("team_id", team.id),
    client.from("team_groups").select("id, group_name, color, position").eq("team_id", team.id).order("position").order("created_at"),
    client.from("team_tasks").select("id, team_id, group_id, task_name, description, difficulty, due_at, status, position, created_at, started_at, completed_at, archived_at").eq("team_id", team.id).order("position").order("created_at"),
    client.from("task_assignees").select("task_id, user_id").eq("team_id", team.id),
    client.from("completion_requests").select("id, task_id, requested_by, note, status, review_note, created_at").eq("team_id", team.id).order("created_at", { ascending: false }),
    client.from("team_task_help_requests").select("id, task_id, requester_id, message, status, created_at, resolved_at").eq("team_id", team.id).order("created_at", { ascending: false }),
  ]);
  if (memberRows.error) throw memberRows.error;
  if (groupRows.error) throw groupRows.error;
  if (taskRows.error) throw taskRows.error;
  if (assignmentRows.error) throw assignmentRows.error;
  if (requestRows.error) throw requestRows.error;
  if (helpRows.error) throw helpRows.error;

  const userIds = memberRows.data.map((item) => item.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await client.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const members: TeamTaskMemberDto[] = memberRows.data.map((item) => ({
    id: item.user_id,
    role: item.role,
    name: profiles.find((profile) => profile.id === item.user_id)?.display_name ?? null,
    avatarUrl: profiles.find((profile) => profile.id === item.user_id)?.avatar_url ?? null,
  }));
  const requests: CompletionRequestDto[] = requestRows.data.map((request) => ({
    id: request.id, taskId: request.task_id, requestedBy: request.requested_by,
    requesterName: profiles.find((profile) => profile.id === request.requested_by)?.display_name ?? null,
    note: request.note, status: request.status, reviewNote: request.review_note, createdAt: request.created_at,
  }));
  const latestRequest = new Map<string, CompletionRequestDto>();
  for (const request of requests) if (!latestRequest.has(request.taskId)) latestRequest.set(request.taskId, request);
  const helpRequests: TeamTaskHelpRequestDto[] = helpRows.data.map((request) => {
    const profile = profiles.find((item) => item.id === request.requester_id);
    return {
      id: request.id,
      taskId: request.task_id,
      requesterId: request.requester_id,
      requesterName: profile?.display_name ?? null,
      requesterAvatarUrl: profile?.avatar_url ?? null,
      message: request.message,
      status: request.status as TeamTaskHelpRequestDto["status"],
      createdAt: request.created_at,
      resolvedAt: request.resolved_at,
    };
  });
  const assignees = new Map<string, string[]>();
  for (const item of assignmentRows.data) (assignees.get(item.task_id) ?? (assignees.set(item.task_id, []), assignees.get(item.task_id)!)).push(item.user_id);
  const groups: TeamTaskGroupDto[] = groupRows.data.map((group) => ({ id: group.id, name: group.group_name, color: group.color, position: group.position }));
  const tasks: TeamTaskDto[] = taskRows.data.map((task) => ({
    id: task.id, groupId: task.group_id, name: task.task_name, description: task.description,
    difficulty: task.difficulty, dueAt: task.due_at,
    status: task.status === "in_progress" || task.status === "done" ? task.status : "todo",
    position: task.position, createdAt: task.created_at, startedAt: task.started_at,
    completedAt: task.completed_at, archivedAt: task.archived_at,
    assigneeIds: assignees.get(task.id) ?? [], latestRequest: latestRequest.get(task.id) ?? null,
    helpRequests: helpRequests.filter((request) => request.taskId === task.id),
  }));
  return { teams, team, invalidTeam, members, groups, tasks, requests, helpRequests };
}
