"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import type { ProfileSummaryDto } from "@/features/profile/dto/profile.dto";
import type { NotificationFeedDto } from "@/features/notifications/dto/notification-feed.dto";

type Props = {
  email: string;
  userId: string;
  profile: ProfileSummaryDto;
  notifications: NotificationFeedDto;
  children: ReactNode;
};

export default function DashboardShell({ email, userId, profile, notifications, children }: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-ink-base font-ui text-slate-100 selection:bg-theme-accent/40">
      <DashboardTopBar
        pathname={pathname}
        email={email}
        userId={userId}
        profile={profile}
        notifications={notifications}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
      />
      <div className="flex min-w-0 flex-1 overflow-x-clip">
        <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 overflow-x-clip p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
