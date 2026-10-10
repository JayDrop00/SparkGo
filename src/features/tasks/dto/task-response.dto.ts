import type { ContentBlockType, Difficulty } from "../schemas/task.schema";

export type TaskBlockDto = {
  id: string;
  type: ContentBlockType;
  text: string;
  isChecked: boolean | null;
};

export type TaskChecklistDto = {
  checked: number;
  total: number;
};

export type TaskResponseDto = {
  id: string;
  taskName: string;
  description: string | null;
  difficulty: Difficulty;
  dueDate: string | null;
  groupId: string | null;
  position: number;
  blocks: TaskBlockDto[];
  checklist: TaskChecklistDto;
  createdAt: string;
  updatedAt: string;
};
