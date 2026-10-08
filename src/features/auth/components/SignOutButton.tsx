"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth?mode=login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="w-fit rounded-xl border border-ink-border bg-ink-card/70 px-5 py-3 font-display text-sm font-extrabold uppercase tracking-wider text-slate-200 transition-colors hover:border-theme-accent hover:text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
