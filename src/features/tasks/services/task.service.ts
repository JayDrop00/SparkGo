import { createClient } from "@/lib/supabase/server";
import type { MoveTaskDto } from "../dto/move-task.dto";
import type { TaskResponseDto } from "../dto/task-response.dto";
import type { CreateTaskData, RescheduleTaskData, UpdateTaskData } from "../schemas/task.schema";
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
    p_deadline_at: input.deadlineAt ? input.deadlineAt.toISOString() : undefined,
    p_start_at: input.startAt ? input.startAt.toISOString() : undefined,
    p_end_at: input.endAt ? input.endAt.toISOString() : undefined,
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
  if (input.groupId) {
    const { data: group, error: groupError } = await supabase
      .from("task_groups")
      .select("id")
      .eq("id", input.groupId)
      .eq("owner_id", uid)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) throw { code: "P0002", message: "group not found" };
  }

  // Updating the row directly avoids depending on a cached PostgREST RPC
  // signature while still enforcing ownership through the owner filter and RLS.
  const patch = {
    task_name: input.taskName,
    description: input.description || null,
    difficulty: input.difficulty,
    due_date: input.endAt?.toISOString() ?? null,
    deadline_at: input.deadlineAt?.toISOString() ?? null,
    group_id: input.groupId ?? null,
    start_at: input.startAt?.toISOString() ?? null,
    end_at: input.endAt?.toISOString() ?? null,
  };
  const update = (values: Partial<typeof patch>) => supabase
    .from("tasks")
    .update(values)
    .eq("id", input.taskId)
    .eq("owner_id", uid)
    .select("*")
    .maybeSingle();

  let result = await update(patch);
  // The optional deadline column may not be deployed yet. Blank deadlines
  // should not prevent edits to task fields or calendar scheduling.
  if (result.error?.code === "PGRST204" && result.error.message.includes("deadline_at") && !input.deadlineAt) {
    const compatiblePatch = {
      task_name: patch.task_name,
      description: patch.description,
      difficulty: patch.difficulty,
      due_date: patch.due_date,
      group_id: patch.group_id,
      start_at: patch.start_at,
      end_at: patch.end_at,
    };
    result = await update(compatiblePatch);
  }
  const { data, error } = result;
  if (error) throw error;
  if (!data) throw { code: "P0002", message: "task not found" };
  return toTaskResponse(data);
}

export async function rescheduleTask(
  uid: string,
  input: RescheduleTaskData,
): Promise<TaskResponseDto> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      start_at: input.startAt?.toISOString() ?? null,
      end_at: input.endAt?.toISOString() ?? null,
      due_date: input.endAt?.toISOString() ?? null,
    })
    .eq("id", input.taskId)
    .eq("owner_id", uid)
    .is("completed_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw { code: "P0002", message: "task not found" };
  return toTaskResponse(data);
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
