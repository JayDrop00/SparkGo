"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import { createClient } from "@/lib/supabase/client";
import ProfileDialog from "@/features/profile/components/ProfileDialog";
import type { ProfileSummaryDto } from "@/features/profile/dto/profile.dto";
import { pageTitle } from "./nav";

type Props = {
  pathname: string;
  email: string;
  userId: string;
  profile: ProfileSummaryDto;
  onToggleSidebar: () => void;
};

export default function DashboardTopBar({ pathname, email, userId, profile: initialProfile, onToggleSidebar }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const title = pageTitle(pathname);
  const initial = (profile.displayName?.trim()[0] ?? email.trim()[0] ?? "U").toUpperCase();
  const menuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  function closeProfileDialog() {
    setProfileOpen(false);
    window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <>
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-ink-border/70 bg-ink-base/85 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-4">
      <button
        type="button"
        aria-label="Toggle navigation"
        onClick={onToggleSidebar}
        className={`rounded-lg border border-ink-border bg-ink-card/70 p-2 text-slate-300 transition-colors hover:border-theme-accent/60 hover:text-white md:hidden ${focusRing}`}
      >
        <Icon name="list" className="h-4 w-4" />
      </button>

      <Link
        href="/dashboard"
        aria-label="SparkGo home"
        className={`flex shrink-0 items-center gap-2 ${focusRing} rounded-lg`}
      >
        <Image
          src="/SparkGo%20Logo.png"
          alt=""
          width={570}
          height={438}
          priority
          unoptimized
          className="h-8 w-auto object-contain"
        />
        <span className="hidden font-display text-base font-black tracking-wider text-white sm:inline">
          Spark
          <span className="bg-linear-to-r from-[#F5710C] to-[#FDC31A] bg-clip-text text-transparent">
            Go
          </span>
        </span>
      </Link>

      <span aria-hidden="true" className="h-5 w-px bg-ink-border" />

      <span className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-wide text-slate-300">
        {title}
      </span>

      <div className="relative" ref={menuRef}>
        <button
          ref={profileTriggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Profile menu"
          onClick={() => setMenuOpen((value) => !value)}
          className={`flex items-center gap-2 rounded-full border border-ink-border bg-ink-card/70 py-1 pl-1 pr-2.5 transition-colors hover:border-theme-accent/60 ${focusRing}`}
        >
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-theme-accent to-theme-secondary font-display text-xs font-black text-ink-base">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" />
            ) : initial}
          </span>
          <span className="hidden max-w-40 truncate font-data text-xs text-slate-300 sm:inline">
            {profile.displayName || email}
          </span>
          <Icon name="chevronDown" className="h-3.5 w-3.5 text-slate-400" />
        </button>

        <div
          role="menu"
          aria-label="Profile"
          className={`hud-card absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl p-2 transition-[opacity,translate,scale,visibility] duration-150 ${
            menuOpen
              ? "opacity-100"
              : "pointer-events-none invisible translate-y-1 scale-95 opacity-0"
          }`}
        >
          {profile.displayName && <p className="truncate px-2 pt-1.5 text-sm font-semibold text-white">{profile.displayName}</p>}
          <p className="truncate px-2 py-1.5 font-data text-[11px] text-slate-400" title={email}>
            {email}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setProfileOpen(true);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-slate-300 transition-colors hover:bg-ink-border/60 hover:text-white ${focusRing}`}
          >
            <Icon name="user" className="h-4 w-4" />
            Edit profile
          </button>
          <ProfileSignOut onDone={() => setMenuOpen(false)} />
        </div>
      </div>
    </header>
    <ProfileDialog
      open={profileOpen}
      onClose={closeProfileDialog}
      userId={userId}
      email={email}
      profile={profile}
      onSaved={setProfile}
    />
    </>
  );
}

function ProfileSignOut({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onDone();
    router.replace("/auth?mode=login");
    router.refresh();
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={busy}
      onClick={handleSignOut}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-60 ${focusRing}`}
    >
      <Icon name="close" className="h-4 w-4" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
