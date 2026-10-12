import { z } from "zod";
import { DIFFICULTY_VALUES } from "@/features/tasks/schemas/task.schema";

export const createTeamGroupSchema = z.object({
  teamId: z.uuid(), name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});
export const deleteTeamGroupSchema = z.object({ groupId: z.uuid(), mode: z.literal("ungroup") });
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
export const teamTaskStatusSchema = z.object({ taskId: z.uuid(), status: z.enum(["in_progress", "done"]) });
export const archiveTeamTaskSchema = z.object({ taskId: z.uuid(), archived: z.boolean() });
export const moveTeamTaskSchema = z.object({
  taskId: z.uuid(), groupId: z.uuid().nullable(), beforeTaskId: z.uuid().nullable().optional(), afterTaskId: z.uuid().nullable().optional(),
});
export const reorderTeamGroupsSchema = z.object({ teamId: z.uuid(), groupIds: z.array(z.uuid()).max(100).refine((ids) => new Set(ids).size === ids.length) });
export const requestTaskHelpSchema = z.object({ taskId: z.uuid(), message: z.string().trim().max(500).nullable().optional() });
export const updateTaskHelpSchema = z.object({ requestId: z.uuid(), resolve: z.boolean() });
export const teamTaskActivitySchema = z.object({ teamId: z.uuid(), startAt: z.string().datetime().nullable(), endAt: z.string().datetime().nullable() });
