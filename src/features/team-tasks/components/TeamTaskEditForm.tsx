"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamTaskDto, TeamTaskGroupDto, TeamTaskMemberDto } from "../dto/team-task.dto";
import { updateTeamTaskAction } from "../actions/team-task.actions";
import TeamMemberPicker from "./TeamMemberPicker";

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

  return <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTeamTaskAction({
        teamId, taskId: task.id, groupId: groupId || null, taskName, description: description || null,
        difficulty, dueAt: dueAt ? new Date(dueAt).toISOString() : null, assigneeIds,
      });
      if (!result.ok) toast.error(result.error.message);
      else { toast.success("Task updated."); onCancel(); }
      router.refresh();
    });
  }}>
    <Field label="Task name"><Input value={taskName} onChange={(event) => setTaskName(event.target.value)} maxLength={200} required /></Field>
    <Field label="Group"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white"><option value="">Ungrouped</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
    <Field label="Description" className="md:col-span-2"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Difficulty"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="w-full rounded-xl border border-ink-border bg-ink-input px-3 py-3 text-sm text-white">{DIFFICULTIES.map((value) => <option key={value} value={value}>{value.replace("_", " ").toLowerCase()}</option>)}</select></Field><Field label="Due date"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field></div>
    <div className="md:col-span-2"><TeamMemberPicker members={members} selectedIds={assigneeIds} onChange={setAssigneeIds} disabled={pending} /></div>
    <div className="flex gap-2 md:col-span-2"><Button size="sm" type="submit" loading={pending}>Save task · Assign to {assigneeIds.length}</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel} disabled={pending}>Cancel</Button></div>
  </form>;
}
