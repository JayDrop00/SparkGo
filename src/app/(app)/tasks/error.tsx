"use client";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export default function TasksError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      icon="close"
      title="The board failed to load"
      description="Something went wrong while fetching your tasks. Check your connection and try again."
      action={
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
