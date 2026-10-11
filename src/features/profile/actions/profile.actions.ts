"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/action-result";
import { toActionError } from "@/utils/action-error";
import type { UpdateProfileDto } from "../dto/profile.dto";
import { updateProfileSchema } from "../schemas/profile.schema";

export async function updateProfileAction(input: unknown): Promise<ActionResult<UpdateProfileDto>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: toActionError(parsed.error) };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again." },
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      avatar_url: parsed.data.avatarUrl,
    })
    .eq("id", user.id)
    .select("display_name, avatar_url")
    .maybeSingle();

  if (error) return { ok: false, error: toActionError(error) };
  if (!data) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Profile not found." } };
  }

  return {
    ok: true,
    data: {
      displayName: data.display_name ?? "",
      avatarUrl: data.avatar_url,
    },
  };
}
