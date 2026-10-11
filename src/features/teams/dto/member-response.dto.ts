export type MemberResponseDto = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "member";
  isOwner: boolean;
  isSelf: boolean;
};
