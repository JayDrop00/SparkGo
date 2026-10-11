"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbg } from "@/lib/debug";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import {
  inviteMemberSchema,
  respondToInviteSchema,
  revokeInviteSchema,
} from "../schemas/invite.schema";

type InviteMutationData = { inviteId: string; teamId?: string };

async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

function authError(): ActionResult<never> {
  return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again." } };
}

function failed<T>(error: { message?: string; code?: string; hint?: string }): ActionResult<T> {
  const stableCode = [
    "NOT_AUTHENTICATED", "NOT_FOUND", "FORBIDDEN", "INVALID_INPUT", "ALREADY_MEMBER",
    "ALREADY_INVITED", "LIMIT_REACHED", "RATE_LIMITED", "OWNER_PROTECTED", "INVALID_STATE",
    "INVITE_EXPIRED", "EMAIL_NOT_CONFIRMED",
  ].find((code) => (error.message ?? "").includes(code));
  dbg("invite", "rpc failed", { stableCode, postgresCode: error.code, hint: error.hint });
  return { ok: false, error: mapSupabaseError(error) };
}

export async function inviteMemberAction(input: unknown): Promise<ActionResult<InviteMutationData>> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("invite", "action started", { action: "invite_to_team", teamId: parsed.data.teamId });
  const { data, error } = await supabase.rpc("invite_to_team", {
    p_team_id: parsed.data.teamId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return failed(error);
  revalidatePath("/teams");
  dbg("invite", "action succeeded", { action: "invite_to_team", teamId: parsed.data.teamId, inviteId: data });
  return { ok: true, data: { inviteId: data, teamId: parsed.data.teamId } };
}

export async function respondToInviteAction(input: unknown): Promise<ActionResult<InviteMutationData>> {
  const parsed = respondToInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("invite", "action started", { action: "respond_to_invite", inviteId: parsed.data.inviteId });
  const { error } = await supabase.rpc("respond_to_invite", {
    p_invite_id: parsed.data.inviteId,
    p_accept: parsed.data.accept,
  });
  if (error) return failed(error);
  revalidatePath("/teams");
  revalidatePath("/team-tasks");
  dbg("invite", "action succeeded", { action: "respond_to_invite", inviteId: parsed.data.inviteId });
  return { ok: true, data: { inviteId: parsed.data.inviteId } };
}

export async function revokeInviteAction(input: unknown): Promise<ActionResult<InviteMutationData>> {
  const parsed = revokeInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const { supabase, user } = await currentUser();
  if (!user) return authError();

  dbg("invite", "action started", { action: "revoke_invite", inviteId: parsed.data.inviteId });
  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: parsed.data.inviteId });
  if (error) return failed(error);
  revalidatePath("/teams");
  dbg("invite", "action succeeded", { action: "revoke_invite", inviteId: parsed.data.inviteId });
  return { ok: true, data: { inviteId: parsed.data.inviteId } };
}
