export type TeamResponseDto = {
  id: string;
  name: string;
  ownerId: string;
  role: "admin" | "manager" | "member";
};
