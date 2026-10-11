import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamRole } from "@/features/teams/constants";

export type TeamTaskGroupDto = { id: string; name: string; color: string | null; position: number };
export type TeamTaskMemberDto = { id: string; name: string | null; role: TeamRole };
export type TeamTaskDto = {
  id: string;
  groupId: string | null;
  name: string;
  description: string | null;
  difficulty: Difficulty;
  dueAt: string | null;
  status: "todo" | "pending_review" | "done";
  position: number;
  assigneeIds: string[];
  latestRequest: CompletionRequestDto | null;
};
export type CompletionRequestDto = {
  id: string;
  taskId: string;
  requestedBy: string;
  requesterName: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNote: string | null;
  createdAt: string;
};
