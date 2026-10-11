"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamTaskPageData } from "../services/team-task.service";
import { assignTeamTaskAction, cancelCompletionRequestAction, createTeamGroupAction, createTeamTaskAction, deleteTeamGroupAction, deleteTeamTaskAction, reorderTeamGroupAction, reorderTeamTaskAction, reviewCompletionRequestAction, submitCompletionRequestAction } from "../actions/team-task.actions";
import TeamTaskEditForm from "./TeamTaskEditForm";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];
const isManager = (role: string) => role === "admin" || role === "manager";

export default function TeamTaskBoard({ data, userId }: { data: TeamTaskPageData; userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [groupName, setGroupName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [groupId, setGroupId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [createAssignees, setCreateAssignees] = useState<string[]>([userId]);
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string[]>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const team = data.team;
  const canManage = Boolean(team && isManager(team.role));

  if (!team) return <EmptyState icon="users" title={data.invalidTeam ? "Team not found" : "No team yet"} description={data.invalidTeam ? "This team is unavailable or you are no longer a member." : "Create or join a team in MyTeam before managing team tasks."} />;

  function finish(result: { ok: boolean; error?: { message: string }; partial?: { taskId: string } }, success: string) {
    if (!result.ok) {
      toast.error(result.partial ? "Task created, but assignment failed. Use the assignee picker below to retry." : result.error?.message ?? "Could not save changes.");
    } else toast.success(success);
    router.refresh();
  }
  function toggle(ids: string[], user: string) { return ids.includes(user) ? ids.filter((id) => id !== user) : [...ids, user]; }

  const taskForm = canManage && <form className="hud-card mb-5 grid gap-3 rounded-2xl p-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTeamTaskAction({
        teamId: team.id, groupId: groupId || null, taskName, description: description || null,
        difficulty, dueAt: dueAt ? new Date(dueAt).toISOString() : null, assigneeIds: createAssignees,
      });
      finish(result, "Task created.");
      if (result.ok || "partial" in result) { setTaskName(""); setDescription(""); setDueAt(""); }
    });
  }}>
    <div className="md:col-span-2"><h2 className="font-display font-bold text-white">Create a team task</h2><p className="text-xs text-slate-400">No checklist or Contents field. You can assign this task to yourself or existing members.</p></div>
    <Field label="Task name"><Input value={taskName} onChange={(event) => setTaskName(event.target.value)} maxLength={200} required /></Field>
    <Field label="Group"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white"><option value="">Ungrouped</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
    <Field label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={2} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Difficulty"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="w-full rounded-xl border border-ink-border bg-ink-input px-3 py-3 text-sm text-white">{DIFFICULTIES.map((value) => <option key={value} value={value}>{value.replace("_", " ").toLowerCase()}</option>)}</select></Field><Field label="Due date"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field></div>
    <fieldset className="md:col-span-2"><legend className="mb-2 text-xs font-semibold text-slate-400">Assign to</legend><div className="flex flex-wrap gap-2">{data.members.map((member) => <label key={member.id} className="flex items-center gap-2 rounded-lg border border-ink-border px-3 py-2 text-sm text-slate-200"><input type="checkbox" checked={createAssignees.includes(member.id)} onChange={() => setCreateAssignees((ids) => toggle(ids, member.id))} />{member.name || `Member ${member.id.slice(0, 6)}`}{member.id === userId ? " (you)" : ""}</label>)}</div></fieldset>
    <div className="md:col-span-2"><Button size="sm" type="submit" loading={pending}>Create task</Button></div>
  </form>;

  return <div>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-white">Team Task</h1><p className="text-sm text-slate-400">{team.name} · {data.members.length} members</p></div><select aria-label="Select team" value={team.id} onChange={(event) => router.push(`/team-tasks?team=${encodeURIComponent(event.target.value)}`)} className="rounded-xl border border-ink-border bg-ink-input px-3 py-2 text-sm text-white">{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></header>
    {canManage && <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await createTeamGroupAction({ teamId: team.id, name: groupName }); finish(result, "Group created."); if (result.ok) setGroupName(""); }); }}><Field label="New group"><Input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} required /></Field><Button size="sm" type="submit" loading={pending}>Add group</Button></form>}
    {taskForm}
    {canManage && data.requests.some((request) => request.status === "pending" && request.requestedBy !== userId) && <section className="hud-card mb-5 rounded-2xl p-4">
      <h2 className="mb-3 font-display font-bold text-white">Review queue <span className="font-data text-xs text-theme-accent">{data.requests.filter((request) => request.status === "pending" && request.requestedBy !== userId).length}</span></h2>
      <ul className="space-y-3">{data.requests.filter((request) => request.status === "pending" && request.requestedBy !== userId).map((request) => {
        const task = data.tasks.find((item) => item.id === request.taskId);
        return <li key={request.id} className="rounded-xl border border-ink-border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{task?.name ?? "Team task"} · {request.requesterName ?? `Member ${request.requestedBy.slice(0, 6)}`}</p><p className="mt-1 text-sm text-slate-400">{request.note || "No note provided."}</p><p className="mt-1 text-xs text-slate-500">Submitted {new Date(request.createdAt).toLocaleString()}</p></div><div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => { if (!window.confirm("Approve this completion request?")) return; startTransition(async () => finish(await reviewCompletionRequestAction({ requestId: request.id, approve: true }), "Completion approved.")); }}>Approve</Button><Button size="sm" variant="secondary" disabled={pending} onClick={() => { const note = window.prompt("Optional reason for rejecting this request:"); if (note === null) return; startTransition(async () => finish(await reviewCompletionRequestAction({ requestId: request.id, approve: false, note }), "Completion rejected.")); }}>Reject</Button></div></div></li>;
      })}</ul>
    </section>}
    <div className="space-y-5">
      {[...data.groups.map((group) => ({ id: group.id, title: group.name, color: group.color, tasks: data.tasks.filter((task) => task.groupId === group.id) })), { id: "ungrouped", title: "Ungrouped", color: null, tasks: data.tasks.filter((task) => task.groupId === null) }].map((section, sectionIndex) => <section key={section.id} className="hud-card rounded-2xl p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display font-bold text-white"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: section.color ?? "#64748b" }} />{section.title}<span className="font-data text-xs text-slate-500">{section.tasks.length}</span></h2>{canManage && <div className="flex gap-2">{section.id !== "ungrouped" && <><Button size="sm" variant="ghost" aria-label={`Move ${section.title} up`} disabled={pending || sectionIndex === 0} onClick={() => startTransition(async () => finish(await reorderTeamGroupAction({ id: section.id, direction: "up" }), "Group moved."))}>↑</Button><Button size="sm" variant="ghost" aria-label={`Move ${section.title} down`} disabled={pending || sectionIndex >= data.groups.length - 1} onClick={() => startTransition(async () => finish(await reorderTeamGroupAction({ id: section.id, direction: "down" }), "Group moved."))}>↓</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => finish(await deleteTeamGroupAction({ groupId: section.id, mode: "ungroup" }), "Group removed; tasks kept ungrouped."))}>Ungroup tasks</Button><Button size="sm" variant="danger" disabled={pending} onClick={() => { if (window.confirm(`Delete ${section.title} and all its tasks?`)) startTransition(async () => finish(await deleteTeamGroupAction({ groupId: section.id, mode: "delete" }), "Group and tasks deleted.")); }}>Delete all</Button></>}</div>}</header>
        {section.tasks.length === 0 ? <p className="py-3 text-sm text-slate-500">No tasks here.</p> : <ul className="space-y-3">{section.tasks.map((task, taskIndex) => {
          const assigned = assigneeDrafts[task.id] ?? task.assigneeIds;
          const assignedNames = task.assigneeIds.map((id) => data.members.find((member) => member.id === id)?.name || `Member ${id.slice(0, 6)}`);
          const isRequester = task.latestRequest?.requestedBy === userId;
          return <li key={task.id} className="rounded-xl border border-ink-border bg-ink-base/40 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-48 flex-1"><p className="font-semibold text-white">{task.name}</p>{task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="neutral">{task.difficulty.toLowerCase().replace("_", " ")}</Badge><Badge tone={task.status === "todo" ? "neutral" : "accent"}>{task.status.replace("_", " ")}</Badge>{task.dueAt && <span className="text-xs text-slate-400">Due {new Date(task.dueAt).toLocaleString()}</span>}</div><p className="mt-2 text-xs text-slate-500">Assigned: {assignedNames.length ? assignedNames.join(", ") : "Nobody yet"}</p></div>{canManage && <div className="flex gap-2">{task.status === "todo" && <><Button size="sm" variant="ghost" aria-label={`Move ${task.name} up`} disabled={pending || taskIndex === 0} onClick={() => startTransition(async () => finish(await reorderTeamTaskAction({ id: task.id, direction: "up" }), "Task moved."))}>↑</Button><Button size="sm" variant="ghost" aria-label={`Move ${task.name} down`} disabled={pending || taskIndex >= section.tasks.length - 1} onClick={() => startTransition(async () => finish(await reorderTeamTaskAction({ id: task.id, direction: "down" }), "Task moved."))}>↓</Button><Button size="sm" variant="secondary" onClick={() => setEditingTaskId((value) => value === task.id ? null : task.id)}>{editingTaskId === task.id ? "Close edit" : "Edit"}</Button></>}<Button size="sm" variant="danger" disabled={pending} onClick={() => { if (window.confirm(`Delete task “${task.name}”?`)) startTransition(async () => finish(await deleteTeamTaskAction({ taskId: task.id }), "Task deleted.")); }}>Delete</Button></div>}</div>
            {editingTaskId === task.id && <TeamTaskEditForm teamId={team.id} task={task} groups={data.groups} members={data.members} onCancel={() => setEditingTaskId(null)} />}
            {canManage && <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-border pt-3"><Field label="Assignees" className="min-w-52 flex-1"><select multiple aria-label={`Assignees for ${task.name}`} value={assigned} onChange={(event) => setAssigneeDrafts((current) => ({ ...current, [task.id]: Array.from(event.target.selectedOptions, (option) => option.value) }))} className="min-h-24 w-full rounded-xl border border-ink-border bg-ink-input px-3 py-2 text-sm text-white">{data.members.map((member) => <option key={member.id} value={member.id}>{member.name || `Member ${member.id.slice(0, 6)}`}{member.id === userId ? " (you)" : ""}</option>)}</select></Field><Button size="sm" variant="secondary" disabled={pending || assigned.length > 20 || task.status !== "todo"} onClick={() => startTransition(async () => finish(await assignTeamTaskAction({ taskId: task.id, userIds: assigned }), "Assignees updated."))}>Save assignees</Button></div>}
            {task.latestRequest?.status === "rejected" && task.latestRequest.reviewNote && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-2 text-sm text-red-200">Review note: {task.latestRequest.reviewNote}</p>}
            {task.status === "pending_review" && <p className="mt-3 text-sm text-theme-accent">Awaiting review{task.latestRequest?.requestedBy === userId ? " · your request" : ""}</p>}
            {canManage && task.status === "todo" && task.assigneeIds.includes(userId) && <Button size="sm" variant="secondary" disabled={pending} onClick={() => { if (!window.confirm("Mark this assigned task complete? It will be auto-approved.")) return; startTransition(async () => finish(await submitCompletionRequestAction({ taskId: task.id }), "Task completed.")); }}>Complete task</Button>}
            {!canManage && team.role === "member" && task.status === "todo" && task.assigneeIds.includes(userId) && <Button size="sm" variant="secondary" disabled={pending} onClick={() => { const note = window.prompt("Optional completion note:"); if (note === null) return; startTransition(async () => finish(await submitCompletionRequestAction({ taskId: task.id, note }), "Completion request submitted.")); }}>Request completion</Button>}
            {team.role === "member" && task.status === "pending_review" && isRequester && task.latestRequest?.status === "pending" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (!window.confirm("Cancel your completion request?")) return; startTransition(async () => finish(await cancelCompletionRequestAction({ requestId: task.latestRequest!.id }), "Completion request cancelled.")); }}>Cancel request</Button>}
          </li>;
        })}</ul>}
      </section>)}
    </div>
  </div>;
}
