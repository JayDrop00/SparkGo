"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import { assignTeamTaskSchema, cancelCompletionSchema, createTeamGroupSchema, createTeamTaskSchema, deleteTeamGroupSchema, deleteTeamTaskSchema, reorderTeamItemSchema, reviewCompletionSchema, submitCompletionSchema, updateTeamTaskSchema } from "../schemas/team-task.schema";

type MutationData = { teamId?: string; taskId?: string };
export type CreateTeamTaskResult = ActionResult<MutationData> | { ok: false; error: ActionResult<never> extends { ok: false; error: infer E } ? E : never; partial: { taskId: string } };
function failed<T>(error: { message?: string; code?: string }): ActionResult<T> { return { ok: false, error: mapSupabaseError(error) }; }
async function authClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createTeamGroupAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = createTeamGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { data: last, error: readError } = await supabase.from("team_groups").select("position").eq("team_id", parsed.data.teamId).order("position", { ascending: false }).limit(1).maybeSingle();
  if (readError) return failed(readError);
  const { error } = await supabase.from("team_groups").insert({ team_id: parsed.data.teamId, group_name: parsed.data.name, color: parsed.data.color ?? null, position: (last?.position ?? 0) + 1024 });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function deleteTeamGroupAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = deleteTeamGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("delete_team_group", { p_group_id: parsed.data.groupId, p_mode: parsed.data.mode });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: {} };
}

export async function createTeamTaskAction(input: unknown): Promise<CreateTeamTaskResult> {
  const parsed = createTeamTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const positionQuery = supabase.from("team_tasks").select("position").eq("team_id", parsed.data.teamId);
  const { data: last, error: readError } = await (parsed.data.groupId
    ? positionQuery.eq("group_id", parsed.data.groupId)
    : positionQuery.is("group_id", null)).order("position", { ascending: false }).limit(1).maybeSingle();
  if (readError) return failed(readError);
  const { data: task, error: insertError } = await supabase.from("team_tasks").insert({
    team_id: parsed.data.teamId, group_id: parsed.data.groupId, task_name: parsed.data.taskName,
    description: parsed.data.description, difficulty: parsed.data.difficulty, due_at: parsed.data.dueAt,
    position: (last?.position ?? 0) + 1024,
  }).select("id").single();
  if (insertError) return failed(insertError);
  const { error: assignmentError } = await supabase.rpc("assign_task_members", { p_task_id: task.id, p_user_ids: parsed.data.assigneeIds });
  revalidatePath("/team-tasks");
  if (assignmentError) return { ok: false, error: mapSupabaseError(assignmentError), partial: { taskId: task.id } };
  return { ok: true, data: { teamId: parsed.data.teamId, taskId: task.id } };
}

export async function assignTeamTaskAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = assignTeamTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("assign_task_members", { p_task_id: parsed.data.taskId, p_user_ids: parsed.data.userIds });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: { taskId: parsed.data.taskId } };
}

export async function deleteTeamTaskAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = deleteTeamTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { data, error } = await supabase.from("team_tasks").delete().eq("id", parsed.data.taskId).select("id").maybeSingle();
  if (error) return failed(error);
  if (!data) return failed({ message: "NOT_FOUND" });
  revalidatePath("/team-tasks");
  return { ok: true, data: { taskId: parsed.data.taskId } };
}

export async function updateTeamTaskAction(input: unknown): Promise<CreateTeamTaskResult> {
  const parsed = updateTeamTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { data: existing, error: readError } = await supabase.from("task_assignees").select("user_id").eq("task_id", parsed.data.taskId);
  if (readError) return failed(readError);
  const { data: updated, error } = await supabase.from("team_tasks").update({
    group_id: parsed.data.groupId, task_name: parsed.data.taskName, description: parsed.data.description,
    difficulty: parsed.data.difficulty, due_at: parsed.data.dueAt,
  }).eq("id", parsed.data.taskId).select("id").maybeSingle();
  if (error) return failed(error);
  if (!updated) return failed({ message: "NOT_FOUND" });
  const currentIds = (existing ?? []).map((item) => item.user_id).sort();
  const nextIds = [...parsed.data.assigneeIds].sort();
  if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
    const { error: assignmentError } = await supabase.rpc("assign_task_members", { p_task_id: parsed.data.taskId, p_user_ids: parsed.data.assigneeIds });
    revalidatePath("/team-tasks");
    if (assignmentError) return { ok: false, error: mapSupabaseError(assignmentError), partial: { taskId: parsed.data.taskId } };
  }
  revalidatePath("/team-tasks");
  return { ok: true, data: { teamId: parsed.data.teamId, taskId: parsed.data.taskId } };
}

export async function reorderTeamTaskAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = reorderTeamItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { data: current, error: readError } = await supabase.from("team_tasks").select("id,team_id,group_id,position").eq("id", parsed.data.id).maybeSingle();
  if (readError) return failed(readError);
  if (!current) return failed({ message: "NOT_FOUND" });
  const siblingsQuery = supabase.from("team_tasks").select("id,position").eq("team_id", current.team_id);
  const { data: siblings, error: siblingsError } = await (current.group_id ? siblingsQuery.eq("group_id", current.group_id) : siblingsQuery.is("group_id", null)).order("position").order("created_at");
  if (siblingsError) return failed(siblingsError);
  const index = siblings.findIndex((item) => item.id === current.id);
  const neighbor = siblings[index + (parsed.data.direction === "up" ? -1 : 1)];
  if (!neighbor) return { ok: true, data: { teamId: current.team_id, taskId: current.id } };
  const first = await supabase.from("team_tasks").update({ position: neighbor.position }).eq("id", current.id);
  if (first.error) return failed(first.error);
  const second = await supabase.from("team_tasks").update({ position: current.position }).eq("id", neighbor.id);
  if (second.error) return failed(second.error);
  revalidatePath("/team-tasks");
  return { ok: true, data: { teamId: current.team_id, taskId: current.id } };
}

export async function reorderTeamGroupAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = reorderTeamItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { data: current, error: readError } = await supabase.from("team_groups").select("id,team_id,position").eq("id", parsed.data.id).maybeSingle();
  if (readError) return failed(readError);
  if (!current) return failed({ message: "NOT_FOUND" });
  const { data: groups, error: groupsError } = await supabase.from("team_groups").select("id,position").eq("team_id", current.team_id).order("position").order("created_at");
  if (groupsError) return failed(groupsError);
  const index = groups.findIndex((item) => item.id === current.id);
  const neighbor = groups[index + (parsed.data.direction === "up" ? -1 : 1)];
  if (!neighbor) return { ok: true, data: { teamId: current.team_id } };
  const first = await supabase.from("team_groups").update({ position: neighbor.position }).eq("id", current.id);
  if (first.error) return failed(first.error);
  const second = await supabase.from("team_groups").update({ position: current.position }).eq("id", neighbor.id);
  if (second.error) return failed(second.error);
  revalidatePath("/team-tasks");
  return { ok: true, data: { teamId: current.team_id } };
}

export async function submitCompletionRequestAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = submitCompletionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("submit_completion_request", { p_task_id: parsed.data.taskId, p_note: parsed.data.note ?? null });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: { taskId: parsed.data.taskId } };
}

export async function cancelCompletionRequestAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = cancelCompletionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("cancel_completion_request", { p_request_id: parsed.data.requestId });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: {} };
}

export async function reviewCompletionRequestAction(input: unknown): Promise<ActionResult<MutationData>> {
  const parsed = reviewCompletionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await authClient();
  if (!user) return failed({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("review_completion_request", {
    p_request_id: parsed.data.requestId, p_approve: parsed.data.approve, p_review_note: parsed.data.note ?? null,
  });
  if (error) return failed(error);
  revalidatePath("/team-tasks");
  return { ok: true, data: {} };
}
