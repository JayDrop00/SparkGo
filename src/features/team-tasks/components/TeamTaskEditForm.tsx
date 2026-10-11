"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamTaskDto, TeamTaskGroupDto, TeamTaskMemberDto } from "../dto/team-task.dto";
import { updateTeamTaskAction } from "../actions/team-task.actions";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function TeamTaskEditForm({ teamId, task, groups, members, onCancel }: {
  teamId: string; task: TeamTaskDto; groups: TeamTaskGroupDto[]; members: TeamTaskMemberDto[]; onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [taskName, setTaskName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty);
  const [groupId, setGroupId] = useState(task.groupId ?? "");
  const [dueAt, setDueAt] = useState(toLocalInput(task.dueAt));
  const [assigneeIds, setAssigneeIds] = useState(task.assigneeIds);
  const toast = useToast();
  const router = useRouter();

  return <form className="mt-3 grid gap-3 rounded-xl border border-theme-accent/20 bg-ink-base/60 p-3 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTeamTaskAction({
        teamId, taskId: task.id, groupId: groupId || null, taskName, description: description || null,
        difficulty, dueAt: dueAt ? new Date(dueAt).toISOString() : null, assigneeIds,
      });
      if (!result.ok) toast.error("partial" in result ? "Task details saved, but assignment failed. Retry in the assignee picker." : result.error.message);
      else { toast.success("Task updated."); onCancel(); }
      router.refresh();
    });
  }}>
    <Field label="Task name"><Input value={taskName} onChange={(event) => setTaskName(event.target.value)} maxLength={200} required /></Field>
    <Field label="Group"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white"><option value="">Ungrouped</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
    <Field label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={2} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Difficulty"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="w-full rounded-xl border border-ink-border bg-ink-input px-3 py-3 text-sm text-white">{DIFFICULTIES.map((value) => <option key={value} value={value}>{value.replace("_", " ").toLowerCase()}</option>)}</select></Field><Field label="Due date"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field></div>
    <fieldset className="md:col-span-2"><legend className="mb-2 text-xs font-semibold text-slate-400">Assignees</legend><div className="flex flex-wrap gap-2">{members.map((member) => <label key={member.id} className="flex items-center gap-2 rounded-lg border border-ink-border px-3 py-2 text-sm text-slate-200"><input type="checkbox" checked={assigneeIds.includes(member.id)} onChange={() => setAssigneeIds((ids) => ids.includes(member.id) ? ids.filter((id) => id !== member.id) : [...ids, member.id])} />{member.name || `Member ${member.id.slice(0, 6)}`}</label>)}</div></fieldset>
    <div className="flex gap-2 md:col-span-2"><Button size="sm" type="submit" loading={pending}>Save task</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
