import { redirect } from "next/navigation";
import { connection } from "next/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getClaimsCached } from "@/features/auth/services/session.service";

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

  return (
    <ToastProvider>
      <DashboardShell email={email}>{children}</DashboardShell>
    </ToastProvider>
  );
}
