"use client";

import { useState, useTransition } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { MemberResponseDto } from "../dto/member-response.dto";
import type { TeamTagsDataDto } from "../dto/tag-response.dto";

export default function TagsPanel({
  data, members, canManage, onCreate, onDelete, onSaveMember,
}: {
  data: TeamTagsDataDto;
  members: MemberResponseDto[];
  canManage: boolean;
  onCreate: (name: string, color: string | null) => Promise<{ ok: boolean; message?: string }>;
  onDelete: (tagId: string) => Promise<{ ok: boolean; message?: string }>;
  onSaveMember: (userId: string, tagIds: string[]) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const toast = useToast();

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return toast.error(result.message ?? "Could not save changes.");
      toast.success(success);
    });
  }

  return (
    <section className="space-y-5">
      <header><h2 className="font-display text-lg font-bold text-white">Team tags</h2><p className="text-sm text-slate-400">Tags label members for display and filtering. They never change permissions.</p></header>
      {canManage && <form className="hud-card flex flex-wrap items-end gap-3 rounded-2xl p-4" onSubmit={(event) => {
        event.preventDefault();
        run(() => onCreate(name, color), "Tag created.");
        setName("");
      }}>
        <Field label="Tag name" className="min-w-48 flex-1"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} required /></Field>
        <Field label="Color"><input aria-label="Tag color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-ink-border bg-ink-input p-1" /></Field>
        <Button size="sm" type="submit" loading={pending}>Add tag</Button>
      </form>}

      {data.tags.length === 0 ? <p className="rounded-xl border border-ink-border p-4 text-sm text-slate-400">No tags have been created yet.</p> :
        <ul className="flex flex-wrap gap-2">{data.tags.map((tag) => <li key={tag.id} className="flex items-center gap-2 rounded-full border border-ink-border px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color ?? "#64748b" }} />
          <span className="text-sm text-white">{tag.name}</span>
          {canManage && <button type="button" aria-label={`Delete ${tag.name}`} disabled={pending} onClick={() => run(() => onDelete(tag.id), "Tag deleted.")} className="text-slate-500 hover:text-red-300">×</button>}
        </li>)}</ul>}

      <div className="space-y-3">
        <h3 className="font-display font-bold text-white">Member labels</h3>
        {members.map((member) => {
          const selected = drafts[member.userId] ?? data.memberTagIds[member.userId] ?? [];
          return <div key={member.userId} className="hud-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
            <div className="min-w-36"><p className="font-semibold text-white">{member.displayName || `Member ${member.userId.slice(0, 6)}`}{member.isSelf ? " (you)" : ""}</p><p className="text-xs capitalize text-slate-400">{member.role}</p></div>
            {canManage ? <div className="flex min-w-52 flex-1 flex-wrap items-center gap-2">
              <select aria-label={`Tags for ${member.displayName || "member"}`} multiple value={selected} disabled={pending} onChange={(event) => setDrafts((current) => ({ ...current, [member.userId]: Array.from(event.target.selectedOptions, (option) => option.value) }))} className="min-h-20 min-w-48 flex-1 rounded-xl border border-ink-border bg-ink-input px-3 py-2 text-sm text-white">
                {data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <Button size="sm" variant="secondary" disabled={pending || selected.length > 5} onClick={() => run(() => onSaveMember(member.userId, selected), "Member tags saved.")}>Save labels</Button>
            </div> : <div className="flex flex-wrap gap-1">{selected.length ? selected.map((tagId) => {
              const tag = data.tags.find((item) => item.id === tagId);
              return tag ? <Badge key={tag.id} tone="neutral">{tag.name}</Badge> : null;
            }) : <span className="text-sm text-slate-500">No labels</span>}</div>}
          </div>;
        })}
      </div>
    </section>
  );
}
