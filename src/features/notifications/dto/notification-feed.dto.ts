export type NotificationKind = "team_invite" | "task_assigned" | "team_role_changed";

export type NotificationItemDto = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  teamId: string;
  taskId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationFeedDto = {
  items: NotificationItemDto[];
  unreadCount: number;
};

export const EMPTY_NOTIFICATION_FEED: NotificationFeedDto = {
  items: [],
  unreadCount: 0,
};
