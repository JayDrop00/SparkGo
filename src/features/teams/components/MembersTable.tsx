"use client";

import Badge from "@/components/ui/Badge";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Image from "next/image";
import type { TeamRole } from "../constants";
import type { MemberResponseDto } from "../dto/member-response.dto";
import { can } from "../permissions";

export default function MembersTable({
  members,
  viewerRole,
  viewerIsOwner,
  onChangeRole,
  onRemove,
}: {
  members: MemberResponseDto[];
  viewerRole: TeamRole;
  viewerIsOwner: boolean;
  onChangeRole: (member: MemberResponseDto, role: TeamRole) => void;
  onRemove: (member: MemberResponseDto) => void;
}) {
  return (
    <div className="relative rounded-2xl border border-ink-border bg-ink-card/40">
      <div className="hidden grid-cols-[minmax(0,1fr)_10rem_3rem] gap-4 border-b border-ink-border px-4 py-3 font-data text-[11px] font-semibold uppercase tracking-widest text-slate-500 sm:grid">
        <span>Member</span><span>Role</span><span />
      </div>
      <ul className="divide-y divide-ink-border/70">
        {members.map((member) => {
          const canManageRole = can(viewerRole, "member.role.change") && !member.isSelf && !member.isOwner && (member.role !== "admin" || viewerIsOwner);
          const canRemove = can(viewerRole, "member.remove") && !member.isSelf && !member.isOwner && (member.role !== "admin" || viewerIsOwner);
          const menuItems = [
            ...(canManageRole ? (["member", "manager", ...(viewerIsOwner ? ["admin"] : [])] as TeamRole[])
              .filter((role) => role !== member.role)
              .map((role) => ({ id: `role-${role}`, label: `Change to ${role}`, onSelect: () => onChangeRole(member, role) })) : []),
            ...(canRemove ? [{ id: "remove", label: "Remove member", danger: true, dividerBefore: canManageRole, onSelect: () => onRemove(member) }] : []),
          ];
          const displayName = member.displayName?.trim() || `Member ${member.userId.slice(0, 6)}`;
          const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

          return (
            <li key={member.userId} className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_3rem] sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-border bg-theme-accent/10 font-display text-sm font-bold text-theme-accent">
                  {member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" /> : initials || "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{displayName}{member.isSelf && <span className="ml-2 text-xs text-slate-400">You</span>}</p>
                  {member.isOwner && <p className="text-xs text-theme-accent">Team owner</p>}
                </div>
              </div>
              <div><Badge tone={member.role === "admin" ? "accent" : "neutral"}>{member.role}</Badge></div>
              <div className="flex justify-end">
                {menuItems.length > 0 && <DropdownMenu ariaLabel={`Actions for ${displayName}`} items={menuItems} portal placement="top" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
