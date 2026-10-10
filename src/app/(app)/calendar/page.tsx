import type { Metadata } from "next";
import EmptyState from "@/components/ui/EmptyState";

// Session-gated shell above reads cookies: render per-request.
export const instant = false;

export const metadata: Metadata = {
  title: "Calendar — SparkGo",
};

export default function CalendarPage() {
  return (
    <EmptyState
      icon="calendar"
      title="Calendar is on the launchpad"
      description="Upcoming due dates and schedules will land here in a future iteration."
    />
  );
}
