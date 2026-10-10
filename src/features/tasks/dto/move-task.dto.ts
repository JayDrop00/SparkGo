export type MoveTaskDto = {
  taskId: string;
  targetGroupId?: string | null;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
};

export type DeleteTaskDto = {
  taskId: string;
};
