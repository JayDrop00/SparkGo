import type { Difficulty } from "../schemas/task.schema";

export type TaskResponseDto = {
  id: string;
  taskName: string;
  description: string | null;
  difficulty: Difficulty;
  dueDate: string | null;
  groupId: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
