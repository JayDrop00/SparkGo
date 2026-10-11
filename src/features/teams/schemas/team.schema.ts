import { z } from "zod";

export const teamNameSchema = z.string().trim().min(1, "Team name is required").max(60);

export const createTeamSchema = z.object({ name: teamNameSchema });
export const renameTeamSchema = z.object({ teamId: z.uuid(), name: teamNameSchema });
export const teamIdSchema = z.object({ teamId: z.uuid() });
export const changeMemberRoleSchema = z.object({
  teamId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(["admin", "manager", "member"]),
});
export const removeMemberSchema = z.object({ teamId: z.uuid(), userId: z.uuid() });
export const transferOwnershipSchema = z.object({ teamId: z.uuid(), newOwnerId: z.uuid() });
export const deleteTeamSchema = z.object({ teamId: z.uuid(), confirmName: z.string().max(60) });

export type CreateTeamInput = z.input<typeof createTeamSchema>;
export type RenameTeamInput = z.input<typeof renameTeamSchema>;
