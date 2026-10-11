"use server";

import { createClient } from "@/lib/supabase/server";
import { EMPTY_NOTIFICATION_FEED } from "../dto/notification-feed.dto";
import { getNotificationFeed } from "../services/notification.service";
import { notificationIdSchema } from "../schemas/notification.schema";

export async function refreshNotificationFeedAction() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return EMPTY_NOTIFICATION_FEED;

  try {
    return await getNotificationFeed(supabase, user.id);
  } catch {
    return EMPTY_NOTIFICATION_FEED;
  }
}

export async function markNotificationReadAction(input: unknown): Promise<boolean> {
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) return false;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("read_at", null);
  return !error;
}

export async function markAllNotificationsReadAction(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  return !error;
}
