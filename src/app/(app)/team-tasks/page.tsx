import type { Metadata } from "next";
import EmptyState from "@/components/ui/EmptyState";

// Session-gated shell above reads cookies: render per-request.
export const instant = false;

export const metadata: Metadata = {
  title: "Team Task — SparkGo",
};

export default function TeamTasksPage() {
  return (
    <EmptyState
      icon="chart"
      title="Team Task is coming soon"
      description="Shared team boards will live here once teams are available."
    />
  );
}
