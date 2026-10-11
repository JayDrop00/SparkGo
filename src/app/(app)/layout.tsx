import { redirect } from "next/navigation";
import { connection } from "next/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getClaimsCached } from "@/features/auth/services/session.service";
import { getProfileSummary } from "@/features/profile/services/profile.service";
import { EMPTY_NOTIFICATION_FEED } from "@/features/notifications/dto/notification-feed.dto";
import { getNotificationFeed } from "@/features/notifications/services/notification.service";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Session-gated layout: getClaims() reads the clock (session expiry), which is
  // unstable during prerender — render per-request before touching Supabase.
  await connection();

  // Request-level cache: pages under this layout (e.g. /tasks) share this
  // single getClaims() verification instead of calling it again.
  const claims = await getClaimsCached();

  if (!claims) {
    redirect("/auth?mode=login&next=/dashboard");
  }

  const email =
    (claims.email as string | undefined) ?? (claims.sub as string | undefined) ?? "Unknown user";
  const userId = claims.sub as string;
  const supabase = await createClient();
  const [profile, notifications] = await Promise.all([
    getProfileSummary(userId),
    getNotificationFeed(supabase, userId, true).catch(() => EMPTY_NOTIFICATION_FEED),
  ]);

  return (
    <ToastProvider>
      <DashboardShell email={email} userId={userId} profile={profile} notifications={notifications}>{children}</DashboardShell>
    </ToastProvider>
  );
}
