export type DeleteGroupDto = {
  groupId: string;
  taskAction: "ungroup" | "delete";
};
