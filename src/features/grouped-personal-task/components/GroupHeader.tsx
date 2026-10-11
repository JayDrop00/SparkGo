"use client";


import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Badge from "@/components/ui/Badge";
import DropdownMenu, { type MenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import { focusRing, inputClass } from "@/components/ui/styles";
import type { GroupResponseDto } from "../dto/group-response.dto";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

const SWATCHES = [
  "#2dd4bf",
  "#38bdf8",
  "#c084fc",
  "#f472b6",
  "#f97316",
  "#facc15",
  "#34d399",
  "#94a3b8",
];

type DragHandleProps = {
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
};

type Props = {
  group: GroupResponseDto;
  collapsed: boolean;
  dragHandleProps?: DragHandleProps;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onRecolor: (color: string | null) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onAddTask: () => void;
};

export default function GroupHeader({
  group,
  collapsed,
  dragHandleProps,
  onToggleCollapse,
  onRename,
  onRecolor,
  onMove,
  onDelete,
  onAddTask,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group.groupName);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  function commitRename() {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== group.groupName) onRename(next);
    else setDraft(group.groupName);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      setDraft(group.groupName);
      setRenaming(false);
    }
  }

  const menuItems: MenuItem[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "pencil",
      onSelect: () => setRenaming(true),
    },
    {
      id: "color",
      label: "Change color",
      icon: "star",
      onSelect: () => setShowColors((value) => !value),
    },
    { id: "up", label: "Move up", icon: "arrowUp", onSelect: () => onMove(-1) },
    { id: "down", label: "Move down", icon: "arrowDown", onSelect: () => onMove(1) },
    {
      id: "delete",
      label: "Delete group",
      icon: "trash",
      danger: true,
      onSelect: onDelete,
    },
  ];

  return (
    <div className="relative border-b border-ink-border/70 p-3">
      <div className="mb-1.5 flex w-full justify-center">
        <button
          type="button"
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          aria-label={`Drag group "${group.groupName}"`}
          className={`flex h-7 w-16 cursor-grab touch-none items-center justify-center rounded-full border border-ink-border bg-ink-input/80 text-slate-300 transition-colors hover:border-theme-accent/60 hover:text-theme-accent active:cursor-grabbing ${focusRing}`}
        >
          <Icon name="gripHorizontal" className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={collapsed ? `Expand ${group.groupName}` : `Collapse ${group.groupName}`}
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
          className={`rounded-md p-1 text-slate-400 transition-colors hover:text-white ${focusRing}`}
        >
          <Icon
            name={collapsed ? "chevronRight" : "chevronDown"}
            className="h-4 w-4"
          />
        </button>

        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
          style={{ backgroundColor: group.color ?? "var(--theme-accent)" }}
        />

        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={60}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={onKeyDown}
            aria-label="Group name"
            className={`${inputClass} min-w-0 flex-1 px-2 py-1 text-sm`}
          />
        ) : (
          <h3
            className="min-w-0 flex-1 truncate text-sm font-bold text-white"
            title={group.groupName}
          >
            {group.groupName}
          </h3>
        )}

        <Badge tone="neutral" title={`${group.taskCount} tasks`}>
          {group.taskCount}
        </Badge>

        <button
          type="button"
          aria-label={`Add task to ${group.groupName}`}
          onClick={onAddTask}
          className={`rounded-md p-1 text-slate-400 transition-colors hover:bg-ink-border hover:text-white ${focusRing}`}
        >
          <Icon name="plus" className="h-4 w-4" />
        </button>

        <DropdownMenu items={menuItems} ariaLabel={`${group.groupName} menu`} />
      </div>

      {showColors && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-border bg-ink-input/80 p-2">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Set group color ${color}`}
              onClick={() => {
                onRecolor(color);
                setShowColors(false);
              }}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${focusRing}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              onRecolor(null);
              setShowColors(false);
            }}
            className={`ml-auto rounded-md border border-ink-border px-2 py-0.5 font-data text-[10px] text-slate-400 transition-colors hover:text-white ${focusRing}`}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
