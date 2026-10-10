"use server";

import { revalidatePath } from "next/cache";
import { getSessionUid } from "@/features/auth/services/session.service";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import type { BoardResponseDto } from "../dto/board-response.dto";
import type { CreateGroupDto } from "../dto/create-group.dto";
import type { DeleteGroupDto } from "../dto/delete-group.dto";
import type { GroupResponseDto } from "../dto/group-response.dto";
import type { ReorderGroupsDto } from "../dto/reorder-groups.dto";
import type { UpdateGroupDto } from "../dto/update-group.dto";
import {
  createGroupSchema,
  deleteGroupSchema,
  reorderGroupsSchema,
  updateGroupSchema,
} from "../schemas/group.schema";
import * as groupService from "../services/group.service";

const UNAUTHENTICATED: ActionResult<never> = {
  ok: false,
  error: { code: "UNAUTHENTICATED", message: "Your session has expired." },
};

export async function getBoardAction(): Promise<ActionResult<BoardResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const board = await groupService.getBoard(uid);
    return { ok: true, data: board };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function createGroupAction(
  input: CreateGroupDto,
): Promise<ActionResult<GroupResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = createGroupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const group = await groupService.createGroup(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: group };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateGroupAction(
  input: UpdateGroupDto,
): Promise<ActionResult<GroupResponseDto>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = updateGroupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const group = await groupService.updateGroup(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: group };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function reorderGroupsAction(
  input: ReorderGroupsDto,
): Promise<ActionResult<{ orderedIds: string[] }>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = reorderGroupsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    await groupService.reorderGroups(uid, parsed.data.orderedIds);
    revalidatePath("/tasks");
    return { ok: true, data: { orderedIds: parsed.data.orderedIds } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteGroupAction(
  input: DeleteGroupDto,
): Promise<ActionResult<{ deletedTasks: number; movedTasks: number }>> {
  try {
    const uid = await getSessionUid();
    if (!uid) return UNAUTHENTICATED;

    const parsed = deleteGroupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

    const result = await groupService.deleteGroup(uid, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
