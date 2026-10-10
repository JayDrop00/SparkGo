"use client";

import { useCallback, useState } from "react";
import type { CreateTaskDto } from "../dto/create-task.dto";
import type { UpdateTaskDto } from "../dto/update-task.dto";
import type { Difficulty } from "../schemas/task.schema";
import { createTaskSchema, updateTaskSchema } from "../schemas/task.schema";
import { zodFieldErrors } from "@/utils/action-error";

export type TaskFormValues = {
  taskName: string;
  description: string;
  difficulty: Difficulty;
  dueDate: string;
  groupId: string | null;
};

export type TaskFormErrors = Record<string, string>;

function toValues(initial?: Partial<TaskFormValues>): TaskFormValues {
  return {
    taskName: initial?.taskName ?? "",
    description: initial?.description ?? "",
    difficulty: initial?.difficulty ?? "MEDIUM",
    dueDate: initial?.dueDate ?? "",
    groupId: initial?.groupId ?? null,
  };
}

function parseDueDate(value: string): string | null | undefined {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function useTaskForm(
  mode: "create" | "edit",
  initial?: Partial<TaskFormValues>,
) {
  const [values, setValues] = useState<TaskFormValues>(() => toValues(initial));
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const setField = useCallback(
    <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setErrors((current) => {
        if (!current[key as string]) return current;
        const next = { ...current };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const validate = useCallback(
    (taskId?: string): { valid: boolean; fieldErrors: TaskFormErrors } => {
      const payload = {
        taskName: values.taskName,
        description: values.description || null,
        difficulty: values.difficulty,
        dueDate: values.dueDate || null,
        groupId: values.groupId,
      };

      const input =
        mode === "create"
          ? payload
          : {
              taskId: taskId ?? "00000000-0000-0000-0000-000000000000",
              ...payload,
            };
      const result =
        mode === "create"
          ? createTaskSchema.safeParse(input)
          : updateTaskSchema.safeParse(input);

      if (result.success) return { valid: true, fieldErrors: {} };

      const flat = zodFieldErrors(result.error);
      const fieldErrors: TaskFormErrors = {};
      for (const [key, messages] of Object.entries(flat)) {
        const rootKey = key.split(".")[0];
        if (!fieldErrors[rootKey]) fieldErrors[rootKey] = messages[0];
      }
      return { valid: false, fieldErrors };
    },
    [mode, values],
  );

  const showFieldError = useCallback(
    (name: string): string | undefined => {
      if (submitAttempted) return errors[name];
      return undefined;
    },
    [errors, submitAttempted],
  );

  const validateForSubmit = useCallback(
    (taskId?: string) => {
      setSubmitAttempted(true);
      const { valid, fieldErrors } = validate(taskId);
      setErrors(fieldErrors);
      return valid;
    },
    [validate],
  );

  const reset = useCallback(
    (next?: Partial<TaskFormValues>) => {
      setValues(toValues(next));
      setErrors({});
      setSubmitAttempted(false);
    },
    [],
  );

  const buildCreatePayload = useCallback(
    (): CreateTaskDto => ({
      taskName: values.taskName,
      description: values.description || null,
      difficulty: values.difficulty,
      dueDate: parseDueDate(values.dueDate),
      groupId: values.groupId,
    }),
    [values],
  );

  const buildUpdatePayload = useCallback(
    (taskId: string): UpdateTaskDto => ({
      taskId,
      taskName: values.taskName,
      description: values.description || null,
      difficulty: values.difficulty,
      dueDate: parseDueDate(values.dueDate),
      groupId: values.groupId,
    }),
    [values],
  );

  return {
    values,
    errors,
    setErrors,
    setField,
    validate,
    validateForSubmit,
    showFieldError,
    reset,
    buildCreatePayload,
    buildUpdatePayload,
  };
}
