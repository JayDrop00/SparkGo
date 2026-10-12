"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createTeamGroupAction } from "../actions/team-task.actions";

export default function TeamGroupCreateDialog({ open, onClose, teamId }: {
  open: boolean;
  onClose: () => void;
  teamId: string;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTeamGroupAction({ teamId, name });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Group created.");
      setName("");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => { if (!pending) onClose(); }}
      title="Add group"
      description="Create a new column for this team’s work."
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form="team-group-create-form" loading={pending} disabled={!name.trim()}>Create group</Button>
        </>
      }
    >
      <form id="team-group-create-form" onSubmit={submit}>
        <Field label="Group name" hint={`${name.length}/60`}>
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="e.g. Launch planning" />
        </Field>
      </form>
    </Dialog>
  );
}
