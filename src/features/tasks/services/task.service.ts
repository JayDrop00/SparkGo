import { createClient } from "@/lib/supabase/server";
import type { MoveTaskDto } from "../dto/move-task.dto";
import type { TaskResponseDto } from "../dto/task-response.dto";
import type { CreateTaskData, UpdateTaskData } from "../schemas/task.schema";
import { toTaskResponse } from "./task.mapper";

export async function fetchTasksForOwner(uid: string): Promise<TaskResponseDto[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("owner_id", uid)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (rows ?? []).map((row) => toTaskResponse(row));
}

export async function getTask(
  uid: string,
  taskId: string,
): Promise<TaskResponseDto | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("owner_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  return toTaskResponse(row);
}

export async function createTask(
  uid: string,
  input: CreateTaskData,
): Promise<TaskResponseDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_task", {
    p_task_name: input.taskName,
    p_description: input.description || undefined,
    p_difficulty: input.difficulty,
    p_due_date: input.dueDate ? input.dueDate.toISOString() : undefined,
    p_group_id: input.groupId ?? undefined,
  });
  if (error) throw error;

  const created = data as unknown as { id: string };
  const task = await getTask(uid, created.id);
  if (!task) throw new Error("created task not found");
  return task;
}

export async function updateTask(
  uid: string,
  input: UpdateTaskData,
): Promise<TaskResponseDto> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task", {
    p_task_id: input.taskId,
    p_task_name: input.taskName,
    p_description: input.description || undefined,
    p_difficulty: input.difficulty,
    p_due_date: input.dueDate ? input.dueDate.toISOString() : undefined,
    p_group_id: input.groupId ?? undefined,
  });
  if (error) throw error;

  const task = await getTask(uid, input.taskId);
  if (!task) throw new Error("updated task not found");
  return task;
}

export async function deleteTask(
  uid: string,
  taskId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("owner_id", uid);
  if (error) throw error;
}

export async function setTaskCompleted(
  uid: string,
  taskId: string,
  completed: boolean,
): Promise<TaskResponseDto> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("owner_id", uid)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw { code: "P0002", message: "task not found" };
  return toTaskResponse(data);
}

export async function moveTask(
  uid: string,
  input: MoveTaskDto,
): Promise<{ taskId: string; groupId: string | null; position: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_task", {
    p_task_id: input.taskId,
    p_target_group_id: input.targetGroupId ?? undefined,
    p_before_task_id: input.beforeTaskId ?? undefined,
    p_after_task_id: input.afterTaskId ?? undefined,
  });
  if (error) throw error;

  const result = data as unknown as {
    id: string;
    groupId: string | null;
    position: number;
  };
  return { taskId: result.id, groupId: result.groupId, position: result.position };
}
