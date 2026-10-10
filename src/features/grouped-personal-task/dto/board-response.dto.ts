import type { TaskResponseDto } from "../../tasks/dto/task-response.dto";
import type { GroupResponseDto } from "./group-response.dto";

export type BoardResponseDto = {
  groups: GroupResponseDto[];
  ungrouped: TaskResponseDto[];
};
