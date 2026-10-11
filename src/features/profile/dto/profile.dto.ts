export type ProfileSummaryDto = {
  displayName: string | null;
  avatarUrl: string | null;
};

export type UpdateProfileDto = ProfileSummaryDto & {
  displayName: string;
};
