import type { Metadata } from "next";
import { connection } from "next/server";
import SignOutButton from "@/features/auth/components/SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard — SparkGo",
};

// Session-gated route with no static shell worth prerendering: render per-request.
export const instant = false;

export default async function DashboardPage() {
  await connection();

  return (
    <section className="mx-auto w-full max-w-6xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-theme-accent/40 bg-theme-accent/10 px-4 py-1.5 font-data text-xs font-semibold tracking-wide text-theme-accent">
        SIGNED IN
      </span>
      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-wide text-white sm:text-4xl">
        Dashboard
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
        Welcome to SparkGo — your mission control for personal and team tasks.
      </p>

      <div className="hud-card mt-8 max-w-xl rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold tracking-wide text-white">
          Pick up where you left off
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Head to <span className="font-semibold text-theme-accent">My Task</span> in the
          sidebar to plan your work in groups like “This Week” or “In Review”.
        </p>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </section>
  );
}
