import { createClient } from "@/lib/supabase/server";

export async function getSessionUid(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return (claims.sub as string | undefined) ?? null;
}
