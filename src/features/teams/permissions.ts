import type { TeamRole } from "./constants";

export type TeamAction =
  | "team.rename"
  | "team.delete"
  | "team.transfer"
  | "invite.manager"
  | "invite.member"
  | "invite.revoke.any"
  | "invite.revoke.own"
  | "member.role.change"
  | "member.remove"
  | "team.leave"
  | "tags.manage";

// UI HINT ONLY. The database enforces every action. Keep aligned with team-collab.md §4.
const PERMISSIONS: Record<TeamRole, readonly TeamAction[]> = {
  admin: [
    "team.rename", "team.delete", "team.transfer", "invite.manager", "invite.member",
    "invite.revoke.any", "member.role.change", "member.remove", "team.leave", "tags.manage",
  ],
  manager: ["invite.member", "invite.revoke.own", "team.leave", "tags.manage"],
  member: ["team.leave"],
};

export function can(role: TeamRole, action: TeamAction): boolean {
  return PERMISSIONS[role].includes(action);
}
