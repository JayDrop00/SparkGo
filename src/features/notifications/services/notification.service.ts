import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { NotificationFeedDto } from "../dto/notification-feed.dto";

type Client = SupabaseClient<Database>;

export async function getNotificationFeed(
  supabase: Client,
  userId: string,
  syncPendingInvites = false,
): Promise<NotificationFeedDto> {
  if (syncPendingInvites) {
    const { error: syncError } = await supabase.rpc("sync_my_team_invite_notifications");
    if (syncError) throw syncError;
  }

  const [itemsResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, team_id, task_id, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (unreadResult.error) throw unreadResult.error;

  return {
    items: itemsResult.data.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      teamId: item.team_id!,
      taskId: item.task_id,
      createdAt: item.created_at,
      readAt: item.read_at,
    })),
    unreadCount: unreadResult.count ?? 0,
  };
}
