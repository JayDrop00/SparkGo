import type { Metadata } from "next";
import EmptyState from "@/components/ui/EmptyState";

// Session-gated shell above reads cookies: render per-request.
export const instant = false;

export const metadata: Metadata = {
  title: "MyTeam — SparkGo",
};

export default function TeamsPage() {
  return (
    <EmptyState
      icon="users"
      title="MyTeam is coming soon"
      description="Create a team, invite teammates, and collaborate on shared tasks — all in one place."
    />
  );
}
