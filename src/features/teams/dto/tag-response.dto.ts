export type TagResponseDto = {
  id: string;
  name: string;
  color: string | null;
};

export type TeamTagsDataDto = {
  tags: TagResponseDto[];
  memberTagIds: Record<string, string[]>;
};
