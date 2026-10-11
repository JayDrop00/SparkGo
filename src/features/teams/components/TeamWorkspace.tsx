"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/types/action-result";
import { changeMemberRoleAction, deleteTeamAction, leaveTeamAction, removeMemberAction, renameTeamAction, transferOwnershipAction } from "../actions/team.actions";
import { revokeInviteAction } from "../actions/invite.actions";
import { createTagAction, deleteTagAction, setMemberTagsAction } from "../actions/tag.actions";
import type { TeamRole } from "../constants";
import type { TeamPageData } from "../services/team.service";
import type { MemberResponseDto } from "../dto/member-response.dto";
import { can } from "../permissions";
import CreateTeamDialog from "./CreateTeamDialog";
import InvitationsBanner from "./InvitationsBanner";
import InviteMemberDialog from "./InviteMemberDialog";
import MembersTable from "./MembersTable";
import TeamSettingsPanel from "./TeamSettingsPanel";
import TagsPanel from "./TagsPanel";
import TeamSwitcher from "./TeamSwitcher";

type ConfirmState = { title: string; description: string; label: string; action: () => Promise<ActionResult<unknown>> };

export default function TeamWorkspace({ data, userId, initialTab }: {
  data: TeamPageData;
  userId: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const team = data.selectedTeam;
  const tab = ["members", "invitations", "tags", "settings"].includes(initialTab ?? "") ? initialTab! : "members";

  function refreshTeam(teamId?: string) {
    if (teamId) router.push(`/teams?team=${encodeURIComponent(teamId)}`);
    else router.refresh();
  }

  function runConfirm() {
    if (!confirm) return;
    const current = confirm;
    startTransition(async () => {
      const result = await current.action();
      setConfirm(null);
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Changes saved.");
      router.refresh();
      if (current.title === "Delete team" || current.title === "Leave team") router.push("/teams");
    });
  }

  if (!team) {
    return (
      <>
        <InvitationsBanner invites={data.incomingInvites} />
        {data.invalidSelectedTeam ? (
          <EmptyState icon="users" title="Team not found" description="This team is unavailable or you are no longer a member." action={<Button variant="secondary" onClick={() => router.push("/teams")}>View my teams</Button>} />
        ) : (
          <EmptyState icon="users" title="Create your first team" description="Create a team, invite teammates, and collaborate on shared tasks." action={<CreateTeamDialog onCreated={refreshTeam} />} />
        )}
      </>
    );
  }

  const selectedTeam = team;

  const viewerIsOwner = selectedTeam.ownerId === userId;
  const visibleTabs = ["members", ...(can(selectedTeam.role, "invite.member") ? ["invitations"] : []), "tags", ...(selectedTeam.role === "admin" ? ["settings"] : [])];
  const selectTab = (value: string) => router.push(`/teams?team=${encodeURIComponent(selectedTeam.id)}&tab=${value}`);

  function confirmChange(title: string, description: string, action: ConfirmState["action"], label = "Confirm") {
    setConfirm({ title, description, action, label });
  }

  function changeRole(member: MemberResponseDto, role: TeamRole) {
    confirmChange("Change member role", `Change ${member.displayName || "this member"} to ${role}?`, () => changeMemberRoleAction({ teamId: selectedTeam.id, userId: member.userId, role }), "Change role");
  }
  function removeMember(member: MemberResponseDto) {
    confirmChange("Remove member", `Remove ${member.displayName || "this member"} from the team? Their team access will end, and team task assignments will be removed.`, () => removeMemberAction({ teamId: selectedTeam.id, userId: member.userId }), "Remove member");
  }

  return (
    <>
      <InvitationsBanner invites={data.incomingInvites} />
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3"><TeamSwitcher teams={data.teams} selectedTeam={selectedTeam} /><Badge tone="accent">{selectedTeam.role}</Badge></div>
        <div className="flex items-center gap-2"><CreateTeamDialog onCreated={refreshTeam} />{can(selectedTeam.role, "invite.member") && <InviteMemberDialog teamId={selectedTeam.id} role={selectedTeam.role} onInvited={() => router.refresh()} />}</div>
      </header>

      <nav aria-label="Team sections" className="mb-5 flex flex-wrap gap-2 border-b border-ink-border pb-3">
        {visibleTabs.map((item) => <button key={item} type="button" onClick={() => selectTab(item)} aria-current={tab === item ? "page" : undefined} className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${tab === item ? "border-theme-accent/40 bg-theme-accent/10 text-theme-accent" : "border-transparent text-slate-400 hover:bg-ink-border/50 hover:text-white"}`}>{item}</button>)}
      </nav>

      {tab === "members" && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-lg font-bold text-white">Members</h2><p className="text-sm text-slate-400">{data.members.length} people in this team.</p></div>{!viewerIsOwner && <Button size="sm" variant="secondary" onClick={() => confirmChange("Leave team", `Leave ${selectedTeam.name}? The owner must transfer ownership before leaving.`, () => leaveTeamAction({ teamId: selectedTeam.id }), "Leave team")}>Leave team</Button>}</div><MembersTable members={data.members} viewerRole={selectedTeam.role} viewerIsOwner={viewerIsOwner} onChangeRole={changeRole} onRemove={removeMember} /></section>}

      {tab === "invitations" && can(selectedTeam.role, "invite.member") && <section className="space-y-4"><div><h2 className="font-display text-lg font-bold text-white">Invitations</h2><p className="text-sm text-slate-400">Invitations you created. They expire after seven days.</p></div>{data.outgoingInvites.length === 0 ? <EmptyState icon="bell" title="No pending invitations" description="Invitations you create will appear here." /> : <ul className="divide-y divide-ink-border rounded-2xl border border-ink-border">{data.outgoingInvites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-white">{invite.email}</p><p className="mt-1 text-sm capitalize text-slate-400">{invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</p></div><Button size="sm" variant="ghost" disabled={pending} onClick={() => confirmChange("Revoke invitation", `Revoke the invitation for ${invite.email}?`, () => revokeInviteAction({ inviteId: invite.id }), "Revoke")}>Revoke</Button></li>)}</ul>}</section>}

      {tab === "tags" && <TagsPanel data={data.tags} members={data.members} canManage={can(selectedTeam.role, "tags.manage")} onCreate={async (name, color) => {
        const result = await createTagAction({ teamId: selectedTeam.id, name, color });
        if (!result.ok) return { ok: false, message: result.error.message };
        router.refresh();
        return { ok: true };
      }} onDelete={async (tagId) => {
        const result = await deleteTagAction({ teamId: selectedTeam.id, tagId });
        if (!result.ok) return { ok: false, message: result.error.message };
        router.refresh();
        return { ok: true };
      }} onSaveMember={async (userId, tagIds) => {
        const result = await setMemberTagsAction({ teamId: selectedTeam.id, userId, tagIds });
        if (!result.ok) return { ok: false, message: result.error.message };
        router.refresh();
        return { ok: true };
      }} />}

      {tab === "settings" && selectedTeam.role === "admin" && <TeamSettingsPanel team={selectedTeam} members={data.members} isOwner={viewerIsOwner} onRename={(name) => startTransition(async () => { const result = await renameTeamAction({ teamId: selectedTeam.id, name }); if (!result.ok) return toast.error(result.error.message); toast.success("Team renamed."); router.refresh(); })} onTransfer={(newOwnerId, displayName) => confirmChange("Transfer ownership", `Make ${displayName} the owner of ${selectedTeam.name}? You will remain an Admin.`, () => transferOwnershipAction({ teamId: selectedTeam.id, newOwnerId }), "Transfer ownership")} onDelete={(confirmName) => confirmChange("Delete team", `Delete ${selectedTeam.name} and all of its shared data? This cannot be undone.`, () => deleteTeamAction({ teamId: selectedTeam.id, confirmName }), "Delete team")} />}

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.title ?? "Confirm"} description={confirm?.description} footer={<><Button variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>Cancel</Button><Button variant={confirm?.title.includes("Delete") || confirm?.title.includes("Remove") ? "danger" : "primary"} loading={pending} onClick={runConfirm}>{confirm?.label ?? "Confirm"}</Button></>}>
        <p className="text-sm text-slate-400">The database checks your role and permissions before making this change.</p>
      </Dialog>
    </>
  );
}
