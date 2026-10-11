import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { IncomingInviteResponseDto, OutgoingInviteResponseDto } from "../dto/invite-response.dto";
import type { MemberResponseDto } from "../dto/member-response.dto";
import type { TeamResponseDto } from "../dto/team-response.dto";
import type { TeamTagsDataDto } from "../dto/tag-response.dto";

type Client = SupabaseClient<Database>;

export type TeamPageData = {
  teams: TeamResponseDto[];
  selectedTeam: TeamResponseDto | null;
  invalidSelectedTeam: boolean;
  members: MemberResponseDto[];
  incomingInvites: IncomingInviteResponseDto[];
  outgoingInvites: OutgoingInviteResponseDto[];
  tags: TeamTagsDataDto;
};

export async function getTeamPageData(
  supabase: Client,
  userId: string,
  selectedTeamId?: string,
): Promise<TeamPageData> {
  const [membershipResult, incomingResult] = await Promise.all([
    supabase.from("team_members").select("team_id, role").eq("user_id", userId),
    supabase
      .from("team_invites")
      .select("id, team_id, team_name, role, expires_at, created_at")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }),
  ]);

  if (membershipResult.error) throw membershipResult.error;
  if (incomingResult.error) throw incomingResult.error;

  const memberships = membershipResult.data;
  const teamIds = memberships.map(({ team_id }) => team_id);
  const incomingInvites: IncomingInviteResponseDto[] = incomingResult.data.map((invite) => ({
    id: invite.id,
    teamId: invite.team_id,
    teamName: invite.team_name,
    role: invite.role as "manager" | "member",
    expiresAt: invite.expires_at,
  }));

  let teams: TeamResponseDto[] = [];
  if (teamIds.length > 0) {
    const { data: teamRows, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, owner_id")
      .in("id", teamIds)
      .order("name");
    if (teamsError) throw teamsError;
    teams = (teamRows ?? []).flatMap((team) => {
      const membership = memberships.find((row) => row.team_id === team.id);
      return membership ? [{ id: team.id, name: team.name, ownerId: team.owner_id, role: membership.role }] : [];
    });
  }

  const selectedTeam = selectedTeamId
    ? teams.find((team) => team.id === selectedTeamId) ?? null
    : teams[0] ?? null;
  const invalidSelectedTeam = Boolean(selectedTeamId && !selectedTeam);
  if (!selectedTeam) {
    return { teams, selectedTeam: null, invalidSelectedTeam, members: [], incomingInvites, outgoingInvites: [], tags: { tags: [], memberTagIds: {} } };
  }

  const [memberResult, outgoingResult, tagsResult, memberTagsResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id, user_id, role")
      .eq("team_id", selectedTeam.id),
    supabase.rpc("list_my_team_invites", { p_team_id: selectedTeam.id }),
    supabase.from("team_tags").select("id, name, color").eq("team_id", selectedTeam.id).order("name"),
    supabase.from("member_tags").select("user_id, tag_id").eq("team_id", selectedTeam.id),
  ]);
  if (memberResult.error) throw memberResult.error;
  if (outgoingResult.error && selectedTeam.role !== "member") throw outgoingResult.error;
  if (tagsResult.error) throw tagsResult.error;
  if (memberTagsResult.error) throw memberTagsResult.error;

  const memberRows = memberResult.data;
  const memberIds = memberRows.map(({ user_id }) => user_id);
  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", memberIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;

  const members: MemberResponseDto[] = memberRows.map((member) => {
    const profile = profiles?.find((row) => row.id === member.user_id);
    return {
      userId: member.user_id,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: member.role,
      isOwner: member.user_id === selectedTeam.ownerId,
      isSelf: member.user_id === userId,
    };
  });

  const outgoingInvites: OutgoingInviteResponseDto[] = (outgoingResult.data ?? []).map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role as "manager" | "member",
    expiresAt: invite.expires_at,
  }));

  const memberTagIds: Record<string, string[]> = {};
  for (const assignment of memberTagsResult.data) {
    (memberTagIds[assignment.user_id] ??= []).push(assignment.tag_id);
  }
  const tags: TeamTagsDataDto = {
    tags: tagsResult.data.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    memberTagIds,
  };

  return { teams, selectedTeam, invalidSelectedTeam, members, incomingInvites, outgoingInvites, tags };
}
