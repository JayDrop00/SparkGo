import type { Database } from "@/types/database.types";
import type { TaskResponseDto } from "../dto/task-response.dto";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export function toTaskResponse(row: TaskRow): TaskResponseDto {
  return {
    id: row.id,
    taskName: row.task_name,
    description: row.description,
    difficulty: row.difficulty,
    dueDate: row.due_date,
    deadlineAt: row.deadline_at,
    startAt: row.start_at,
    endAt: row.end_at,
    groupId: row.group_id,
    position: row.position,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
