export type IncomingInviteResponseDto = {
  id: string;
  teamId: string;
  teamName: string;
  role: "manager" | "member";
  expiresAt: string;
};

export type OutgoingInviteResponseDto = {
  id: string;
  email: string;
  role: "manager" | "member";
  expiresAt: string;
};
