/** Limits in this module mirror private.team_limit() in the Phase 1 migration. */
export const TEAM_LIMITS = {
  maxOwnedTeams: 5,
  maxTeamMembers: 50,
  maxPendingInvites: 50,
  maxInvitesPerHour: 20,
  maxTagsPerTeam: 30,
  maxTagsPerMember: 5,
  maxAssigneesPerTask: 20,
  teamNameMax: 60,
} as const;

export const TEAM_ROLES = ["admin", "manager", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
