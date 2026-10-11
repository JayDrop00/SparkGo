import { z } from "zod";

export const inviteMemberSchema = z.object({
  teamId: z.uuid(),
  email: z.string().trim().email().max(254),
  role: z.enum(["manager", "member"]),
});
export const respondToInviteSchema = z.object({ inviteId: z.uuid(), accept: z.boolean() });
export const revokeInviteSchema = z.object({ inviteId: z.uuid() });

export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type RespondToInviteInput = z.input<typeof respondToInviteSchema>;
