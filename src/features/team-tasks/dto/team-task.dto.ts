import type { Difficulty } from "@/features/tasks/schemas/task.schema";
import type { TeamRole } from "@/features/teams/constants";

export type TeamTaskGroupDto = { id: string; name: string; color: string | null; position: number };
export type TeamTaskMemberDto = { id: string; name: string | null; avatarUrl: string | null; role: TeamRole };
export type TeamTaskDto = {
  id: string;
  groupId: string | null;
  name: string;
  description: string | null;
  difficulty: Difficulty;
  dueAt: string | null;
  status: "todo" | "in_progress" | "done";
  position: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  assigneeIds: string[];
  latestRequest: CompletionRequestDto | null;
  helpRequests: TeamTaskHelpRequestDto[];
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

export type TeamTaskHelpRequestDto = {
  id: string;
  taskId: string;
  requesterId: string | null;
  requesterName: string | null;
  requesterAvatarUrl: string | null;
  message: string | null;
  status: "open" | "resolved" | "cancelled";
  createdAt: string;
  resolvedAt: string | null;
};

export type TeamTaskActivityDto = {
  tasksCreated: number;
  tasksCompleted: number;
  tasksStarted: number;
  helpRequests: number;
};
