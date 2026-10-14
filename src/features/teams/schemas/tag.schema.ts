import { z } from "zod";

export const createTagSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});
export const deleteTagSchema = z.object({ teamId: z.string().uuid(), tagId: z.string().uuid() });
export const assignMemberTagSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  tagId: z.string().uuid(),
});
