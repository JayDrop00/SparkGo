import { z } from "zod";

export const GROUP_NAME_MAX = 60;

export const createGroupSchema = z.object({
  groupName: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(GROUP_NAME_MAX, `Group name must be at most ${GROUP_NAME_MAX} characters`),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #2dd4bf")
    .optional()
    .nullable(),
});

export const updateGroupSchema = z.object({
  groupId: z.uuid("Invalid group"),
  groupName: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(GROUP_NAME_MAX, `Group name must be at most ${GROUP_NAME_MAX} characters`)
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #2dd4bf")
    .optional()
    .nullable(),
});

export const reorderGroupsSchema = z.object({
  orderedIds: z.array(z.uuid("Invalid group")).min(1, "No groups to reorder"),
});

export const deleteGroupSchema = z.object({
  groupId: z.uuid("Invalid group"),
  taskAction: z.enum(["ungroup", "delete"]),
});

export type CreateGroupInput = z.input<typeof createGroupSchema>;
export type CreateGroupData = z.output<typeof createGroupSchema>;
export type UpdateGroupInput = z.input<typeof updateGroupSchema>;
export type UpdateGroupData = z.output<typeof updateGroupSchema>;
export type DeleteGroupData = z.output<typeof deleteGroupSchema>;
