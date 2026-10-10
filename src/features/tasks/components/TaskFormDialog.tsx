"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createTaskAction, updateTaskAction } from "../actions/task.actions";
import type { TaskBlockDto, TaskResponseDto } from "../dto/task-response.dto";
import { useTaskForm } from "../hooks/use-task-form";
import {
  DESCRIPTION_MAX,
  DIFFICULTY_VALUES,
  TASK_NAME_MAX,
  type ContentBlockInput,
  type Difficulty,
} from "../schemas/task.schema";
import ContentBlockEditor from "./ContentBlockEditor";
import { difficultyLabel } from "./DifficultyBadge";

const DIFFICULTY_STYLES: Record<
  Difficulty,
  { active: string; idle: string }
> = {
  EASY: {
    active: "border-emerald-400/60 bg-emerald-400/20 text-emerald-200",
    idle: "border-ink-border text-slate-400 hover:border-emerald-400/40 hover:text-emerald-300",
  },
  MEDIUM: {
    active: "border-sky-400/60 bg-sky-400/20 text-sky-200",
    idle: "border-ink-border text-slate-400 hover:border-sky-400/40 hover:text-sky-300",
  },
  HARD: {
    active: "border-amber-400/60 bg-amber-400/20 text-amber-200",
    idle: "border-ink-border text-slate-400 hover:border-amber-400/40 hover:text-amber-300",
  },
  VERY_HARD: {
    active: "border-red-400/60 bg-red-400/20 text-red-200",
    idle: "border-ink-border text-slate-400 hover:border-red-400/40 hover:text-red-300",
  },
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isPastDate(date: Date): boolean {
  return date.getTime() < Date.now();
}

function blocksToInputs(blocks: TaskBlockDto[]): ContentBlockInput[] {
  return blocks.map((block) =>
    block.type === "CHECKBOX"
      ? { type: "CHECKBOX", text: block.text, isChecked: block.isChecked ?? false }
      : block.type === "LIST_ITEM"
        ? { type: "LIST_ITEM", text: block.text }
        : { type: "NOTE", text: block.text },
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  groups: Array<{ id: string; groupName: string }>;
  task?: TaskResponseDto | null;
  defaultGroupId?: string | null;
  onSaved: (task: TaskResponseDto) => void;
};

export default function TaskFormDialog({
  open,
  onClose,
  groups,
  task,
  defaultGroupId,
  onSaved,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const mode = task ? "edit" : "create";
  const form = useTaskForm(mode);
  const {
    values,
    errors,
    setErrors,
    setField,
    validateForSubmit,
    showFieldError,
    reset,
    buildCreatePayload,
    buildUpdatePayload,
  } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      task
        ? {
            taskName: task.taskName,
            description: task.description ?? "",
            difficulty: task.difficulty,
            dueDate: toLocalInput(task.dueDate),
            groupId: task.groupId,
            blocks: blocksToInputs(task.blocks),
          }
        : { groupId: defaultGroupId ?? null },
    );
  }, [open, task, defaultGroupId, reset]);

  const nameError = showFieldError("taskName") ?? errors.taskName;
  const dueDateError = showFieldError("dueDate") ?? errors.dueDate;
  const descriptionError = showFieldError("description") ?? errors.description;
  const blocksError = showFieldError("blocks") ?? errors.blocks;

  const dueDateValue = values.dueDate ? new Date(values.dueDate) : null;
  const overdue =
    dueDateValue !== null &&
    !Number.isNaN(dueDateValue.getTime()) &&
    isPastDate(dueDateValue);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!validateForSubmit(task?.id)) return;

    setSubmitting(true);
    const result = task
      ? await updateTaskAction(buildUpdatePayload(task.id))
      : await createTaskAction(buildCreatePayload());
    setSubmitting(false);

    if (result.ok) {
      toast.success(task ? "Task updated." : "Task created.");
      onSaved(result.data);
      onClose();
      return;
    }

    if (result.error.code === "UNAUTHENTICATED") {
      toast.error("Your session has expired — please log in again.");
      router.replace("/auth?mode=login&next=/tasks");
      return;
    }

    toast.error(result.error.message);
    if (result.error.fieldErrors) {
      const mapped: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.error.fieldErrors)) {
        if (messages[0]) mapped[key] = messages[0];
      }
      setErrors(mapped);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      description={
        task
          ? "Update the details, contents, and placement of this task."
          : "Capture a task, then drop it into a group on the board."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={submitting}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Task name" error={nameError}>
          <Input
            name="taskName"
            value={values.taskName}
            onChange={(event) => setField("taskName", event.target.value)}
            maxLength={TASK_NAME_MAX}
            placeholder="e.g. Draft Q4 roadmap outline"
            invalid={Boolean(nameError)}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Description"
          error={descriptionError}
          hint={`${values.description.length}/${DESCRIPTION_MAX}`}
        >
          <Textarea
            name="description"
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            maxLength={DESCRIPTION_MAX}
            placeholder="Optional details, links, context…"
            invalid={Boolean(descriptionError)}
          />
        </Field>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Difficulty</span>
          <div role="radiogroup" aria-label="Difficulty" className="flex flex-wrap gap-2">
            {DIFFICULTY_VALUES.map((value) => {
              const selected = values.difficulty === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField("difficulty", value)}
                  className={`rounded-full border px-3.5 py-1.5 font-data text-xs font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent ${
                    selected ? DIFFICULTY_STYLES[value].active : DIFFICULTY_STYLES[value].idle
                  }`}
                >
                  {difficultyLabel(value)}
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Due date"
          error={dueDateError}
          hint={overdue ? undefined : "Optional"}
        >
          <div className="flex items-center gap-2">
            <Input
              name="dueDate"
              type="datetime-local"
              value={values.dueDate}
              onChange={(event) => setField("dueDate", event.target.value)}
              invalid={Boolean(dueDateError)}
              className="font-data text-xs"
            />
            {overdue && <Badge tone="danger">Overdue</Badge>}
          </div>
        </Field>

        <Field label="Group" hint="Optional">
          <select
            name="groupId"
            value={values.groupId ?? ""}
            onChange={(event) => setField("groupId", event.target.value || null)}
            className="w-full appearance-none rounded-xl border border-ink-border bg-ink-input px-4 py-3.5 text-sm text-white outline-none transition hover:border-theme-accent/50 focus:border-theme-accent focus:ring-4 focus:ring-theme-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
          >
            <option value="" className="bg-ink-card">
              Ungrouped
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id} className="bg-ink-card">
                {group.groupName}
              </option>
            ))}
          </select>
        </Field>

        <ContentBlockEditor
          blocks={values.blocks}
          onChange={(next) => setField("blocks", next)}
          error={blocksError}
        />
      </form>
    </Dialog>
  );
}
