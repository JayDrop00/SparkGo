"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import type { MemberResponseDto } from "../dto/member-response.dto";
import type { TeamResponseDto } from "../dto/team-response.dto";

export default function TeamSettingsPanel({
  team,
  members,
  isOwner,
  onRename,
  onTransfer,
  onDelete,
}: {
  team: TeamResponseDto;
  members: MemberResponseDto[];
  isOwner: boolean;
  onRename: (name: string) => void;
  onTransfer: (userId: string, displayName: string) => void;
  onDelete: (confirmName: string) => void;
}) {
  const [name, setName] = useState(team.name);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const candidates = members.filter((member) => !member.isSelf);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="hud-card rounded-2xl p-5">
        <h3 className="font-display font-bold text-white">Team name</h3>
        <p className="mt-1 text-sm text-slate-400">Admins can rename this team.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); onRename(name); }}>
          <Field label="Name" className="min-w-56 flex-1"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></Field>
          <Button size="sm" type="submit" disabled={name.trim() === team.name}>Save name</Button>
        </form>
      </section>

      {isOwner && <section className="hud-card rounded-2xl p-5">
        <h3 className="font-display font-bold text-white">Transfer ownership</h3>
        <p className="mt-1 text-sm text-slate-400">The new owner becomes an Admin. You will remain an Admin.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="New owner" className="min-w-56 flex-1">
            <select className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white" value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)}>
              <option value="">Choose a team member</option>
              {candidates.map((member) => <option key={member.userId} value={member.userId}>{member.displayName || `Member ${member.userId.slice(0, 6)}`} · {member.role}</option>)}
            </select>
          </Field>
          <Button size="sm" variant="secondary" disabled={!newOwnerId} onClick={() => {
            const member = candidates.find((item) => item.userId === newOwnerId);
            if (member) onTransfer(member.userId, member.displayName || "this member");
          }}>Transfer</Button>
        </div>
      </section>}

      {isOwner && <section className="hud-card rounded-2xl border-red-400/20 p-5 lg:col-span-2">
        <h3 className="font-display font-bold text-red-200">Delete team</h3>
        <p className="mt-1 text-sm text-slate-400">This permanently deletes the team and its shared data. Type <strong className="text-white">{team.name}</strong> to confirm.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Confirm team name" className="min-w-56 flex-1"><Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></Field>
          <Button size="sm" variant="danger" disabled={confirmName !== team.name} onClick={() => onDelete(confirmName)}>Delete team</Button>
        </div>
      </section>}
    </div>
  );
}
