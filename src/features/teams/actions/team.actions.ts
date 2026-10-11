"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbg } from "@/lib/debug";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import type { TeamRole } from "../constants";
import {
  changeMemberRoleSchema,
  createTeamSchema,
  deleteTeamSchema,
  removeMemberSchema,
  renameTeamSchema,
  teamIdSchema,
  transferOwnershipSchema,
} from "../schemas/team.schema";

type TeamMutationData = { teamId: string };

async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

function authError(): ActionResult<never> {
  return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again." } };
}

function failed<T>(scope: string, error: { message?: string; code?: string; hint?: string }): ActionResult<T> {
  const stableCode = Object.keys({
    NOT_AUTHENTICATED: 1, NOT_FOUND: 1, FORBIDDEN: 1, INVALID_INPUT: 1,
    ALREADY_MEMBER: 1, ALREADY_INVITED: 1, LIMIT_REACHED: 1, RATE_LIMITED: 1,
    OWNER_PROTECTED: 1, INVALID_STATE: 1, INVITE_EXPIRED: 1, EMAIL_NOT_CONFIRMED: 1,
  }).find((key) => (error.message ?? "").includes(key));
  dbg(scope, "rpc failed", { stableCode, postgresCode: error.code, hint: error.hint });
  return { ok: false, error: mapSupabaseError(error) };
}

export async function createTeamAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "create_team", userId: user.id });
  const { data, error } = await supabase.rpc("create_team", { p_name: parsed.data.name });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  dbg("team", "action succeeded", { action: "create_team", teamId: data });
  return { ok: true, data: { teamId: data } };
}

export async function renameTeamAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = renameTeamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "rename_team", teamId: parsed.data.teamId });
  const { error } = await supabase.rpc("rename_team", {
    p_team_id: parsed.data.teamId,
    p_name: parsed.data.name,
  });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  dbg("team", "action succeeded", { action: "rename_team", teamId: parsed.data.teamId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = changeMemberRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "change_member_role", teamId: parsed.data.teamId, userId: parsed.data.userId });
  const { error } = await supabase.rpc("change_member_role", {
    p_team_id: parsed.data.teamId,
    p_user_id: parsed.data.userId,
    p_new_role: parsed.data.role as TeamRole,
  });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  dbg("team", "action succeeded", { action: "change_member_role", teamId: parsed.data.teamId, userId: parsed.data.userId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function removeMemberAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "remove_member", teamId: parsed.data.teamId, userId: parsed.data.userId });
  const { error } = await supabase.rpc("remove_member", {
    p_team_id: parsed.data.teamId,
    p_user_id: parsed.data.userId,
  });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  revalidatePath("/team-tasks");
  dbg("team", "action succeeded", { action: "remove_member", teamId: parsed.data.teamId, userId: parsed.data.userId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function leaveTeamAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = teamIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "leave_team", teamId: parsed.data.teamId });
  const { error } = await supabase.rpc("leave_team", { p_team_id: parsed.data.teamId });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  revalidatePath("/team-tasks");
  dbg("team", "action succeeded", { action: "leave_team", teamId: parsed.data.teamId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function transferOwnershipAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = transferOwnershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "transfer_team_ownership", teamId: parsed.data.teamId, targetUserId: parsed.data.newOwnerId });
  const { error } = await supabase.rpc("transfer_team_ownership", {
    p_team_id: parsed.data.teamId,
    p_new_owner_id: parsed.data.newOwnerId,
  });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  dbg("team", "action succeeded", { action: "transfer_team_ownership", teamId: parsed.data.teamId, targetUserId: parsed.data.newOwnerId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function deleteTeamAction(input: unknown): Promise<ActionResult<TeamMutationData>> {
  const parsed = deleteTeamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("team", "action started", { action: "delete_team", teamId: parsed.data.teamId });
  const { error } = await supabase.rpc("delete_team", {
    p_team_id: parsed.data.teamId,
    p_confirm_name: parsed.data.confirmName,
  });
  if (error) return failed("team", error);
  revalidatePath("/teams");
  revalidatePath("/team-tasks");
  dbg("team", "action succeeded", { action: "delete_team", teamId: parsed.data.teamId });
  return { ok: true, data: { teamId: parsed.data.teamId } };
}
