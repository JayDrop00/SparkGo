import { redirect } from "next/navigation";
import { connection } from "next/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Session-gated layout: getClaims() reads the clock (session expiry), which is
  // unstable during prerender — render per-request before touching Supabase.
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

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
