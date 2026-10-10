import type { Database } from "@/types/database.types";
import type { TaskBlockDto, TaskResponseDto } from "../dto/task-response.dto";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type BlockRow = Database["public"]["Tables"]["task_content_blocks"]["Row"];

export function toTaskResponse(row: TaskRow, blocks: BlockRow[]): TaskResponseDto {
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const mapped: TaskBlockDto[] = sorted.map((block) => ({
    id: block.id,
    type: block.block_type,
    text: block.text,
    isChecked: block.is_checked,
  }));
  const checkboxBlocks = mapped.filter((block) => block.type === "CHECKBOX");

  return {
    id: row.id,
    taskName: row.task_name,
    description: row.description,
    difficulty: row.difficulty,
    dueDate: row.due_date,
    groupId: row.group_id,
    position: row.position,
    blocks: mapped,
    checklist: {
      checked: checkboxBlocks.filter((block) => block.isChecked).length,
      total: checkboxBlocks.length,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function groupBlocksByTask(
  blocks: BlockRow[],
): Map<string, BlockRow[]> {
  const map = new Map<string, BlockRow[]>();
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    const list = map.get(block.task_id);
    if (list) list.push(block);
    else map.set(block.task_id, [block]);
  }
  return map;
}
