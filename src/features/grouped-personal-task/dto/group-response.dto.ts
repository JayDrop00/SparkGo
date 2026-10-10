import type { TaskResponseDto } from "../../tasks/dto/task-response.dto";

export type GroupResponseDto = {
  id: string;
  groupName: string;
  color: string | null;
  position: number;
  taskCount: number;
  tasks: TaskResponseDto[];
  completedTasks: TaskResponseDto[];
};
