"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import { createTagSchema, deleteTagSchema, setMemberTagsSchema } from "../schemas/tag.schema";

type TagMutationData = { teamId: string };
function invalid<T>(error: { message?: string; code?: string }): ActionResult<T> {
  return { ok: false, error: mapSupabaseError(error) };
}

export async function createTagAction(input: unknown): Promise<ActionResult<TagMutationData>> {
  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalid({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.from("team_tags").insert({
    team_id: parsed.data.teamId, name: parsed.data.name, color: parsed.data.color ?? null,
  });
  if (error) return invalid(error);
  revalidatePath("/teams");
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function deleteTagAction(input: unknown): Promise<ActionResult<TagMutationData>> {
  const parsed = deleteTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalid({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.from("team_tags").delete().eq("team_id", parsed.data.teamId).eq("id", parsed.data.tagId);
  if (error) return invalid(error);
  revalidatePath("/teams");
  return { ok: true, data: { teamId: parsed.data.teamId } };
}

export async function setMemberTagsAction(input: unknown): Promise<ActionResult<TagMutationData>> {
  const parsed = setMemberTagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalid({ message: "NOT_AUTHENTICATED" });
  const { error } = await supabase.rpc("set_member_tags", {
    p_team_id: parsed.data.teamId, p_user_id: parsed.data.userId, p_tag_ids: parsed.data.tagIds,
  });
  if (error) return invalid(error);
  revalidatePath("/teams");
  return { ok: true, data: { teamId: parsed.data.teamId } };
}
