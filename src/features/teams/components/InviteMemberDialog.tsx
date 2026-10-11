"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { TeamRole } from "../constants";
import { inviteMemberAction } from "../actions/invite.actions";

export default function InviteMemberDialog({ teamId, role, onInvited }: {
  teamId: string;
  role: TeamRole;
  onInvited: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "member">("member");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteMemberAction({ teamId, email, role: inviteRole });
      if (!result.ok) return toast.error(result.error.message);
      toast.success(`Invitation created for ${email.trim()}. They can see it after signing in with that email.`);
      setOpen(false);
      setEmail("");
      onInvited();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Invite member</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Invite a teammate" description="No email is sent. They will see the invitation in MyTeam after signing in." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="invite-member-form" loading={pending}>Create invitation</Button></>}>
        <form id="invite-member-form" onSubmit={submit} className="space-y-5">
          <Field label="Email address"><Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Team role">
            <select className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "manager" | "member")}>
              {role === "admin" && <option value="manager">Manager</option>}
              <option value="member">Member</option>
            </select>
          </Field>
        </form>
      </Dialog>
    </>
  );
}
