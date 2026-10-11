import { z } from "zod";
import { DIFFICULTY_VALUES } from "@/features/tasks/schemas/task.schema";

export const createTeamGroupSchema = z.object({
  teamId: z.uuid(), name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});
export const deleteTeamGroupSchema = z.object({ groupId: z.uuid(), mode: z.enum(["delete", "ungroup"]) });
export const createTeamTaskSchema = z.object({
  teamId: z.uuid(), groupId: z.uuid().nullable(), taskName: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(), difficulty: z.enum(DIFFICULTY_VALUES),
  dueAt: z.string().datetime().nullable(), assigneeIds: z.array(z.uuid()).max(20).refine((ids) => new Set(ids).size === ids.length),
});
export const assignTeamTaskSchema = z.object({ taskId: z.uuid(), userIds: z.array(z.uuid()).max(20).refine((ids) => new Set(ids).size === ids.length) });
export const deleteTeamTaskSchema = z.object({ taskId: z.uuid() });
export const updateTeamTaskSchema = createTeamTaskSchema.extend({ taskId: z.uuid() });
export const reorderTeamItemSchema = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) });
export const submitCompletionSchema = z.object({ taskId: z.uuid(), note: z.string().trim().max(500).nullable().optional() });
export const cancelCompletionSchema = z.object({ requestId: z.uuid() });
export const reviewCompletionSchema = z.object({ requestId: z.uuid(), approve: z.boolean(), note: z.string().trim().max(500).nullable().optional() });
