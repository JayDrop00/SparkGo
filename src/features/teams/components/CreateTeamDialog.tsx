"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createTeamAction } from "../actions/team.actions";
import { TEAM_LIMITS } from "../constants";

export default function CreateTeamDialog({ onCreated }: { onCreated: (teamId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTeamAction({ name });
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Team created.");
      setOpen(false);
      setName("");
      onCreated(result.data.teamId);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create team</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Create a team"
        description={`You can own up to ${TEAM_LIMITS.maxOwnedTeams} teams.`}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="create-team-form" loading={pending}>Create team</Button></>}
      >
        <form id="create-team-form" onSubmit={submit} className="space-y-5">
          <Field label="Team name" hint={`Up to ${TEAM_LIMITS.teamNameMax} characters`}>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={TEAM_LIMITS.teamNameMax} required autoComplete="organization" />
          </Field>
        </form>
      </Dialog>
    </>
  );
}
