import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/features/auth/components/SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard — SparkGo",
};

// Session lookup via cookies() makes this route fully dynamic.
export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/auth?mode=login&next=/dashboard");
  }

  const identity = (claims.email as string | undefined) ?? claims.sub ?? "Unknown user";

  return (
    <main className="min-h-screen bg-ink-base font-ui text-slate-100 selection:bg-theme-accent/40">
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-theme-accent/40 bg-theme-accent/10 px-4 py-1.5 font-data text-xs font-semibold tracking-wide text-theme-accent">
          SIGNED IN
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-wide text-white sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
          Signed in as <span className="font-semibold text-theme-accent">{identity}</span>
        </p>

        <div className="hud-card mt-8 max-w-xl rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold tracking-wide text-white">
            You&apos;re in.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This placeholder dashboard exists to verify Supabase auth. Session cookies are
            refreshed on every request by the app proxy, and this page re-checks your session
            on the server.
          </p>
        </div>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
