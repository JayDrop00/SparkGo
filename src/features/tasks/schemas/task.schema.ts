import { z } from "zod";

export const DIFFICULTY_VALUES = ["EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
export type Difficulty = (typeof DIFFICULTY_VALUES)[number];

export const TASK_NAME_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const DUE_DATE_GRACE_MS = 60_000;

const dueDateSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return parsed;
  });

const taskCoreFields = {
  taskName: z
    .string()
    .trim()
    .min(1, "Task name is required")
    .max(TASK_NAME_MAX, `Task name must be at most ${TASK_NAME_MAX} characters`),
  description: z
    .string()
    .max(DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters`)
    .optional()
    .nullable(),
  difficulty: z.enum(DIFFICULTY_VALUES).default("MEDIUM"),
  groupId: z.uuid("Invalid group").optional().nullable(),
};

export const createTaskSchema = z.object({
  ...taskCoreFields,
  dueDate: dueDateSchema
    .optional()
    .nullable()
    .refine(
      (date) => !date || date.getTime() + DUE_DATE_GRACE_MS > Date.now(),
      "Due date cannot be in the past",
    ),
});

export const updateTaskSchema = z.object({
  taskId: z.uuid("Invalid task"),
  ...taskCoreFields,
  dueDate: dueDateSchema.optional().nullable(),
});

export const moveTaskSchema = z
  .object({
    taskId: z.uuid("Invalid task"),
    targetGroupId: z.uuid("Invalid group").optional().nullable(),
    beforeTaskId: z.uuid("Invalid task").optional().nullable(),
    afterTaskId: z.uuid("Invalid task").optional().nullable(),
  })
  .refine(
    (value) =>
      value.beforeTaskId === undefined ||
      value.afterTaskId === undefined ||
      value.beforeTaskId === null ||
      value.afterTaskId === null ||
      value.beforeTaskId !== value.afterTaskId,
    "Invalid drop position",
  )
  .refine(
    (value) =>
      value.beforeTaskId !== value.taskId && value.afterTaskId !== value.taskId,
    "A task cannot be its own anchor",
  );

export const deleteTaskSchema = z.object({
  taskId: z.uuid("Invalid task"),
});

export const setTaskCompletedSchema = z.object({
  taskId: z.uuid("Invalid task"),
  completed: z.boolean(),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type CreateTaskData = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type UpdateTaskData = z.output<typeof updateTaskSchema>;
export type MoveTaskData = z.output<typeof moveTaskSchema>;
