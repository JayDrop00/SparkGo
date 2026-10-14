"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamTaskGroupDto, TeamTaskMemberDto } from "../dto/team-task.dto";
import { createTeamTaskAction } from "../actions/team-task.actions";
import TeamMemberPicker from "./TeamMemberPicker";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];

export default function TeamTaskCreateDialog({
  open,
  onClose,
  teamId,
  groups,
  members,
  userId,
  defaultGroupId,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  groups: TeamTaskGroupDto[];
  members: TeamTaskMemberDto[];
  userId: string;
  defaultGroupId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [groupId, setGroupId] = useState(defaultGroupId ?? "");
  const [dueAt, setDueAt] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(members.some((member) => member.id === userId) ? [userId] : []);
  const toast = useToast();
  const router = useRouter();

  // Keep groupId in sync if defaultGroupId changes when opening
  useEffect(() => {
    if (open) {
      setGroupId(defaultGroupId ?? "");
    }
  }, [open, defaultGroupId]);

  function close() {
    if (pending) return;
    onClose();
    setTaskName("");
    setDescription("");
    setDifficulty("MEDIUM");
    setGroupId(defaultGroupId ?? "");
    setDueAt("");
    setAssigneeIds(members.some((member) => member.id === userId) ? [userId] : []);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTeamTaskAction({
        teamId,
        groupId: groupId || null,
        taskName,
        description: description || null,
        difficulty,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        assigneeIds,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Task created in ${groups.find((group) => group.id === groupId)?.name ?? "Ungrouped"} · ${assigneeIds.length} assigned.`);
      onClose();
      setTaskName("");
      setDescription("");
      setGroupId("");
      setDueAt("");
      setAssigneeIds(members.some((member) => member.id === userId) ? [userId] : []);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create new task"
      description="Add a task to this team and choose who will receive it."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
          <Button type="submit" form="team-task-create-form" loading={pending} disabled={!taskName.trim() || assigneeIds.length > 20}>
            Create task{assigneeIds.length ? ` · ${assigneeIds.length} assigned` : ""}
          </Button>
        </>
      }
    >
      <form id="team-task-create-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Task name"><Input autoFocus value={taskName} onChange={(event) => setTaskName(event.target.value)} maxLength={200} required /></Field>
          <Field label="Group">
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white outline-none focus:border-theme-accent">
              <option value="">Ungrouped</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3 text-sm text-white outline-none focus:border-theme-accent">
              {DIFFICULTIES.map((value) => <option key={value} value={value}>{value.replace("_", " ").toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Due date"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>
          <Field label="Description" className="md:col-span-2"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} placeholder="Add a little context for your team" /></Field>
        </div>
        <TeamMemberPicker members={members} selectedIds={assigneeIds} onChange={setAssigneeIds} disabled={pending} />
      </form>
    </Dialog>
  );
}
