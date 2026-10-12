"use client";

import { useMemo, useState } from "react";
import type { TeamTaskMemberDto } from "../dto/team-task.dto";

function initials(name: string | null, id: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() : id.slice(0, 2).toUpperCase();
}

export default function TeamMemberPicker({
  members,
  selectedIds,
  onChange,
  disabled = false,
}: {
  members: TeamTaskMemberDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? members.filter((member) => (member.name ?? "").toLocaleLowerCase().includes(normalized))
      : members;
  }, [members, query]);
  const selected = members.filter((member) => selectedIds.includes(member.id));

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Assign members</p>
        <span className="rounded-full border border-ink-border bg-ink-base/60 px-2.5 py-1 font-data text-[11px] text-slate-300">
          {selectedIds.length} selected
        </span>
      </div>
      {members.length > 8 && (
        <input
          aria-label="Search team members"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          className="w-full rounded-xl border border-ink-border bg-ink-input px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-theme-accent"
        />
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected members">
          {selected.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-1.5 rounded-full border border-theme-accent/30 bg-theme-accent/10 px-2 py-1 text-xs text-theme-accent">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-theme-accent/20 font-data text-[9px] font-bold">{initials(member.name, member.id)}</span>
              {member.name || `Member ${member.id.slice(0, 6)}`}
            </span>
          ))}
        </div>
      )}
      <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {visibleMembers.map((member) => {
          const isSelected = selectedIds.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(member.id)}
              className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50 ${isSelected ? "border-theme-accent/60 bg-theme-accent/10" : "border-ink-border bg-ink-base/40 hover:border-slate-500"}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-data text-[10px] font-bold ${isSelected ? "bg-theme-accent text-ink-base" : "bg-ink-border text-slate-300"}`}>
                {initials(member.name, member.id)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">{member.name || `Member ${member.id.slice(0, 6)}`}</span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${isSelected ? "border-theme-accent bg-theme-accent text-ink-base" : "border-slate-600 text-transparent"}`} aria-hidden="true">
                ✓
              </span>
            </button>
          );
        })}
        {visibleMembers.length === 0 && <p className="col-span-full py-3 text-center text-sm text-slate-500">No matching members.</p>}
      </div>
    </div>
  );
}
