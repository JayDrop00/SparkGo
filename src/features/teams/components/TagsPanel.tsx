"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { MemberResponseDto } from "../dto/member-response.dto";
import type { TeamTagsDataDto } from "../dto/tag-response.dto";

export default function TagsPanel({
  data, members, canManage, onCreate, onDelete, onToggleMemberTag,
}: {
  data: TeamTagsDataDto;
  members: MemberResponseDto[];
  canManage: boolean;
  onCreate: (name: string, color: string | null) => Promise<{ ok: boolean; message?: string }>;
  onDelete: (tagId: string) => Promise<{ ok: boolean; message?: string }>;
  onToggleMemberTag: (userId: string, tagId: string, shouldAssign: boolean) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [prevMemberTagIds, setPrevMemberTagIds] = useState(data.memberTagIds);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const panelElRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerElRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const width = panelElRef.current?.offsetWidth ?? 224;
    const height = panelElRef.current?.offsetHeight ?? 200;
    const below = rect.bottom + gap;
    const above = rect.top - height - gap;
    const fitsBelow = below + height <= window.innerHeight - 8;
    const placeAbove = !fitsBelow && above >= 8;
    const top = placeAbove ? Math.max(8, above) : below;
    const left = Math.min(
      Math.max(8, rect.right - width),
      Math.max(8, window.innerWidth - width - 8),
    );
    setPanelPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!openFor) return;
    updatePanelPosition();
    const onScroll = () => updatePanelPosition();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [openFor, updatePanelPosition]);

  if (prevMemberTagIds !== data.memberTagIds) {
    setPrevMemberTagIds(data.memberTagIds);
    setOverrides({});
  }

  useEffect(() => {
    if (!openFor) return;
    function onPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest("[data-tag-popover]")) setOpenFor(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenFor(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openFor]);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) return toast.error(result.message ?? "Could not save changes.");
        toast.success(success);
      } catch {
        toast.error("Could not save changes.");
      }
    });
  }

  function toggleTag(member: MemberResponseDto, tagId: string) {
    if (busyMember) return;
    const current = overrides[member.userId] ?? data.memberTagIds[member.userId] ?? [];
    const shouldAssign = !current.includes(tagId);
    const next = shouldAssign ? [...current, tagId] : current.filter((id) => id !== tagId);
    setOverrides((state) => ({ ...state, [member.userId]: next }));
    setBusyMember(member.userId);
    onToggleMemberTag(member.userId, tagId, shouldAssign)
      .then((result) => {
        if (!result.ok) {
          setOverrides((state) => ({ ...state, [member.userId]: current }));
          toast.error(result.message ?? "Could not update tags.");
        }
      })
      .catch(() => {
        setOverrides((state) => ({ ...state, [member.userId]: current }));
        toast.error("Could not update tags.");
      })
      .finally(() => setBusyMember(null));
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const label = member.displayName || `Member ${member.userId.slice(0, 6)}`;
            const assigned = overrides[member.userId] ?? data.memberTagIds[member.userId] ?? [];
            const busy = busyMember === member.userId;
            return (
              <div key={member.userId} data-tag-popover className="hud-card relative rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white" title={label}>{label}{member.isSelf ? " (you)" : ""}</p>
                    <p className="text-xs capitalize text-slate-400">{member.role}</p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      aria-label={`Assign tags to ${label}`}
                      aria-expanded={openFor === member.userId}
                      disabled={busy}
                      onClick={(event) => {
                        triggerElRef.current = event.currentTarget;
                        setOpenFor((current) => (current === member.userId ? null : member.userId));
                      }}
                      className="shrink-0 rounded-full border border-ink-border px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-theme-accent/40 hover:text-theme-accent"
                    >
                      Tag assigning
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {assigned.length === 0 ? <span className="text-sm text-slate-500">No tags yet</span> : assigned.map((tagId) => {
                    const tag = data.tags.find((item) => item.id === tagId);
                    if (!tag) return null;
                    return (
                      <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-border px-2.5 py-1 text-xs text-white">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color ?? "#64748b" }} />
                        <span className="max-w-[10ch] truncate" title={tag.name}>{tag.name}</span>
                        {canManage && <button type="button" aria-label={`Remove ${tag.name} from ${label}`} disabled={busy} onClick={() => toggleTag(member, tag.id)} className="text-slate-500 hover:text-red-300">×</button>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {canManage && openFor && typeof document !== "undefined" && (() => {
        const member = members.find((item) => item.userId === openFor);
        if (!member) return null;
        const assigned = overrides[member.userId] ?? data.memberTagIds[member.userId] ?? [];
        const busy = busyMember === member.userId;
        return createPortal(
          <div
            ref={panelElRef}
            data-tag-popover
            className="fixed z-[60] w-56 rounded-xl border border-ink-border bg-ink-card p-2 shadow-2xl"
            style={panelPos ? { top: panelPos.top, left: panelPos.left } : { top: 0, left: 0, visibility: "hidden" }}
          >
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tag assigning</p>
            {data.tags.length === 0 ? <p className="px-2 py-2 text-sm text-slate-500">No tags created yet.</p> :
              <ul className="max-h-48 overflow-y-auto">{data.tags.map((tag) => {
                const on = assigned.includes(tag.id);
                return (
                  <li key={tag.id}>
                    <button type="button" disabled={busy} onClick={() => toggleTag(member, tag.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-border/50">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color ?? "#64748b" }} />
                      <span className="min-w-0 flex-1 truncate text-white" title={tag.name}>{tag.name}</span>
                      {on && <span className="text-theme-accent" aria-hidden>✓</span>}
                    </button>
                  </li>
                );
              })}</ul>}
          </div>,
          document.body,
        );
      })()}
    </section>
  );
}
