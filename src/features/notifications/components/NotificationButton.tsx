"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  refreshNotificationFeedAction,
} from "../actions/notification.actions";
import type {
  NotificationFeedDto,
  NotificationItemDto,
} from "../dto/notification-feed.dto";

const iconByKind: Record<NotificationItemDto["kind"], IconName> = {
  team_invite: "users",
  task_assigned: "checked",
  team_role_changed: "user",
};

function notificationHref(item: NotificationItemDto) {
  if (item.kind === "task_assigned") {
    return `/team-tasks?team=${encodeURIComponent(item.teamId)}`;
  }
  if (item.kind === "team_role_changed") {
    return `/teams?team=${encodeURIComponent(item.teamId)}`;
  }
  return "/teams";
}

function createdLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function NotificationButton({ initialFeed }: { initialFeed: NotificationFeedDto }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState(initialFeed);

  const refresh = useCallback(async () => {
    const nextFeed = await refreshNotificationFeedAction();
    setFeed(nextFeed);
  }, []);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    };
    const timer = window.setInterval(poll, 20_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markAllRead() {
    if (busy || feed.unreadCount === 0) return;
    setBusy(true);
    try {
      const succeeded = await markAllNotificationsReadAction().catch(() => false);
      if (succeeded) {
        const readAt = new Date().toISOString();
        setFeed((current) => ({
          unreadCount: 0,
          items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(item: NotificationItemDto) {
    if (!item.readAt) {
      const succeeded = await markNotificationReadAction(item.id).catch(() => false);
      if (succeeded) {
        setFeed((current) => ({
          unreadCount: Math.max(0, current.unreadCount - 1),
          items: current.items.map((candidate) => candidate.id === item.id
            ? { ...candidate, readAt: new Date().toISOString() }
            : candidate),
        }));
      }
    }
    setOpen(false);
    router.push(notificationHref(item));
  }

  const badge = feed.unreadCount > 99 ? "99+" : feed.unreadCount;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={feed.unreadCount ? `Notifications, ${feed.unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void refresh().catch(() => undefined);
        }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-ink-border bg-ink-card/70 text-slate-300 transition-colors hover:border-theme-accent/60 hover:text-white ${focusRing}`}
      >
        <Icon name="bell" className="h-4 w-4" />
        {feed.unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-ink-base bg-theme-accent px-1 font-data text-[9px] font-bold leading-none text-ink-base">{badge}</span>}
      </button>

      <div
        id="notification-panel"
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
        className={`hud-card absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw_-_1.5rem)] origin-top-right overflow-hidden rounded-2xl transition-[opacity,translate,scale,visibility] duration-150 ${open ? "opacity-100" : "pointer-events-none invisible translate-y-1 scale-95 opacity-0"}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink-border px-4 py-3">
          <div>
            <h2 className="font-display font-bold text-white">Notifications</h2>
            <p className="mt-0.5 text-xs text-slate-500">Invitations, task assignments, and team role updates</p>
          </div>
          {feed.unreadCount > 0 && <button type="button" disabled={busy} onClick={() => void markAllRead()} className="shrink-0 text-xs font-semibold text-theme-accent hover:text-white disabled:opacity-50">Mark all read</button>}
        </header>
        <div className="max-h-[min(26rem,65vh)] overflow-y-auto p-2">
          {feed.items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-1">
              {feed.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-ink-border/50 ${!item.readAt ? "bg-theme-accent/[0.06]" : ""}`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.readAt ? "bg-ink-border/60 text-slate-400" : "bg-theme-accent/10 text-theme-accent"}`}>
                      <Icon name={iconByKind[item.kind]} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">{item.title}</span>
                        {!item.readAt && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-theme-accent" />}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-400">{item.body}</span>
                      <span className="mt-1.5 block font-data text-[10px] text-slate-500">{createdLabel(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
