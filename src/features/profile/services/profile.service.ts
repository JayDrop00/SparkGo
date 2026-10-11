import { createClient } from "@/lib/supabase/server";
import type { ProfileSummaryDto } from "../dto/profile.dto";

export async function getProfileSummary(userId: string): Promise<ProfileSummaryDto> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return {
    displayName: data?.display_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
  };
}
