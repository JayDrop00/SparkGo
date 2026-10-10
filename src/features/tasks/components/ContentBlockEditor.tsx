"use client";

import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { focusRing, inputClass } from "@/components/ui/styles";
import { BLOCK_TEXT_MAX, type ContentBlockInput } from "../schemas/task.schema";

const BLOCK_META: Record<
  ContentBlockInput["type"],
  { label: string; icon: IconName }
> = {
  CHECKBOX: { label: "Checkbox", icon: "squareCheck" },
  LIST_ITEM: { label: "List item", icon: "list" },
  NOTE: { label: "Note", icon: "fileText" },
};

type Props = {
  blocks: ContentBlockInput[];
  onChange: (blocks: ContentBlockInput[]) => void;
  error?: string | undefined;
};

export default function ContentBlockEditor({ blocks, onChange, error }: Props) {
  function update(index: number, next: ContentBlockInput) {
    onChange(blocks.map((block, i) => (i === index ? next : block)));
  }

  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add(type: ContentBlockInput["type"]) {
    const block: ContentBlockInput =
      type === "CHECKBOX" ? { type, text: "", isChecked: false } : { type, text: "" };
    onChange([...blocks, block]);
  }

  return (
    <div className="space-y-2.5">
      <span className="flex items-center justify-between text-sm font-medium text-slate-200">
        <span>Contents</span>
        <span className="font-data text-[11px] text-slate-500">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </span>
      </span>

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-border bg-ink-input/60 px-3 py-4 text-center text-xs text-slate-500">
          No content blocks yet — add a checkbox, list item, or note below.
        </p>
      )}

      <ul className="space-y-2">
        {blocks.map((block, index) => {
          const meta = BLOCK_META[block.type];
          return (
            <li
              key={index}
              className="flex items-start gap-2 rounded-xl border border-ink-border bg-ink-input/70 p-2"
            >
              <span
                title={meta.label}
                className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-border bg-ink-card text-theme-accent"
              >
                <Icon name={meta.icon} className="h-3.5 w-3.5" />
              </span>

              {block.type === "CHECKBOX" && (
                <input
                  type="checkbox"
                  checked={block.isChecked ?? false}
                  onChange={(event) =>
                    update(index, { ...block, isChecked: event.target.checked })
                  }
                  aria-label={`Mark "${block.text || meta.label}" as done`}
                  className="mt-2.5 h-4 w-4 shrink-0 accent-theme-accent"
                />
              )}

              <input
                type="text"
                value={block.text}
                maxLength={BLOCK_TEXT_MAX}
                placeholder={meta.label}
                aria-label={`${meta.label} text`}
                onChange={(event) => update(index, { ...block, text: event.target.value })}
                className={`${inputClass} border-transparent bg-transparent px-2 py-1.5 hover:border-ink-border`}
              />

              <div className="mt-1 flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Move ${meta.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className={`rounded-md p-1.5 text-slate-400 transition-colors hover:bg-ink-border hover:text-white disabled:opacity-30 ${focusRing}`}
                >
                  <Icon name="arrowUp" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${meta.label} down`}
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                  className={`rounded-md p-1.5 text-slate-400 transition-colors hover:bg-ink-border hover:text-white disabled:opacity-30 ${focusRing}`}
                >
                  <Icon name="arrowDown" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${meta.label}`}
                  onClick={() => remove(index)}
                  className={`rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-400/15 hover:text-red-300 ${focusRing}`}
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => add("CHECKBOX")}>
          <Icon name="squareCheck" className="h-3.5 w-3.5" />
          Add checkbox
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => add("LIST_ITEM")}>
          <Icon name="list" className="h-3.5 w-3.5" />
          Add list item
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => add("NOTE")}>
          <Icon name="fileText" className="h-3.5 w-3.5" />
          Add note
        </Button>
      </div>

      {error && (
        <span role="alert" className="block font-data text-xs text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
