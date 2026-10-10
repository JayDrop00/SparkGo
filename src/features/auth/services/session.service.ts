import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Verified JWT claims for the current request. Memoized with React cache()
 * so the (app) layout and pages share a single getClaims() round-trip. */
export const getClaimsCached = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

export async function getSessionUid(): Promise<string | null> {
  const claims = await getClaimsCached();
  return (claims?.sub as string | undefined) ?? null;
}
