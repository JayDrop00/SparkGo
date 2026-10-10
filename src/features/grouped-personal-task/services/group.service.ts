import { createClient } from "@/lib/supabase/server";
import type { TaskResponseDto } from "@/features/tasks/dto/task-response.dto";
import type { BoardResponseDto } from "../dto/board-response.dto";
import type { DeleteGroupDto } from "../dto/delete-group.dto";
import type { GroupResponseDto } from "../dto/group-response.dto";
import type { CreateGroupData, UpdateGroupData } from "../schemas/group.schema";
import { fetchTasksForOwner } from "../../tasks/services/task.service";

type GroupRow = {
  id: string;
  group_name: string;
  color: string | null;
  position: number;
};

function toGroupResponse(row: GroupRow): GroupResponseDto {
  return {
    id: row.id,
    groupName: row.group_name,
    color: row.color,
    position: row.position,
    taskCount: 0,
    tasks: [],
    completedTasks: [],
  };
}

export async function getBoard(uid: string): Promise<BoardResponseDto> {
  const supabase = await createClient();
  const [{ data: groups, error }, tasks] = await Promise.all([
    supabase
      .from("task_groups")
      .select("*")
      .eq("owner_id", uid)
      .order("position")
      .order("created_at"),
    fetchTasksForOwner(uid),
  ]);
  if (error) throw error;

  const groupList = (groups ?? []).map(toGroupResponse);
  const byGroup = new Map<string, GroupResponseDto>();
  for (const group of groupList) byGroup.set(group.id, group);

  const ungrouped: TaskResponseDto[] = [];
  const ungroupedCompleted: TaskResponseDto[] = [];
  const place = (task: TaskResponseDto, completed: boolean) => {
    const group = task.groupId ? byGroup.get(task.groupId) : null;
    if (group) {
      (completed ? group.completedTasks : group.tasks).push(task);
      group.taskCount = group.tasks.length + group.completedTasks.length;
      return;
    }
    (completed ? ungroupedCompleted : ungrouped).push(task);
  };

  const active = tasks.filter((task) => task.completedAt === null);
  const completed = tasks
    .filter((task) => task.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  for (const task of active) place(task, false);
  for (const task of completed) place(task, true);

  return { groups: groupList, ungrouped, ungroupedCompleted };
}

export async function createGroup(
  uid: string,
  input: CreateGroupData,
): Promise<GroupResponseDto> {
  const supabase = await createClient();
  const { data: last, error: lastError } = await supabase
    .from("task_groups")
    .select("position")
    .eq("owner_id", uid)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const { data, error } = await supabase
    .from("task_groups")
    .insert({
      owner_id: uid,
      group_name: input.groupName,
      color: input.color ?? null,
      position: (last?.position ?? 0) + 1024,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toGroupResponse(data);
}

export async function updateGroup(
  uid: string,
  input: UpdateGroupData,
): Promise<GroupResponseDto> {
  const patch: { group_name?: string; color?: string | null } = {};
  if (input.groupName !== undefined) patch.group_name = input.groupName;
  if (input.color !== undefined) patch.color = input.color;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_groups")
    .update(patch)
    .eq("id", input.groupId)
    .eq("owner_id", uid)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw { code: "P0002", message: "group not found" };
  return toGroupResponse(data);
}

export async function reorderGroups(
  uid: string,
  orderedIds: string[],
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_groups", {
    p_ordered_ids: orderedIds,
  });
  if (error) throw error;
}

export async function deleteGroup(
  uid: string,
  input: DeleteGroupDto,
): Promise<{ deletedTasks: number; movedTasks: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_group", {
    p_group_id: input.groupId,
    p_task_action: input.taskAction,
  });
  if (error) throw error;
  return (data ?? { deletedTasks: 0, movedTasks: 0 }) as {
    deletedTasks: number;
    movedTasks: number;
  };
}
