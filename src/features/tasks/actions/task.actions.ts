"use server";

import { revalidatePath } from "next/cache";
import { getSessionUid } from "@/features/auth/services/session.service";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import type { CreateTaskDto } from "../dto/create-task.dto";
import type { DeleteTaskDto, MoveTaskDto } from "../dto/move-task.dto";
import type { SetTaskCompletedDto } from "../dto/set-task-completed.dto";
import type { TaskResponseDto } from "../dto/task-response.dto";
import type { UpdateTaskDto } from "../dto/update-task.dto";
import {
  createTaskSchema,
  deleteTaskSchema,
  moveTaskSchema,
  setTaskCompletedSchema,
  updateTaskSchema,
} from "../schemas/task.schema";
import * as taskService from "../services/task.service";

const UNAUTHENTICATED: ActionResult<never> = {
  ok: false,
  error: { code: "UNAUTHENTICATED", message: "Your session has expired." },
};

export async function createTaskAction(
  input: CreateTaskDto,
): Promise<ActionResult<TaskResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const task = await taskService.createTask(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: task };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateTaskAction(
  input: UpdateTaskDto,
): Promise<ActionResult<TaskResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const task = await taskService.updateTask(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: task };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteTaskAction(
  input: DeleteTaskDto,
): Promise<ActionResult<{ taskId: string }>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = deleteTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    await taskService.deleteTask(uid, parsed.data.taskId);
    revalidatePath("/tasks");
    return { ok: true, data: { taskId: parsed.data.taskId } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function setTaskCompletedAction(
  input: SetTaskCompletedDto,
): Promise<ActionResult<TaskResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = setTaskCompletedSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const task = await taskService.setTaskCompleted(
      uid,
      parsed.data.taskId,
      parsed.data.completed,
    );
    revalidatePath("/tasks");
    return { ok: true, data: task };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function moveTaskAction(
  input: MoveTaskDto,
): Promise<ActionResult<{ taskId: string; groupId: string | null; position: number }>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = moveTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const result = await taskService.moveTask(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
