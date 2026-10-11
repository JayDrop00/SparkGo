"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TimezoneCookie() {
  const router = useRouter();
  useEffect(() => {
    if (document.cookie.split(";").some((part) => part.trim().startsWith("tz="))) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    document.cookie = `tz=${timezone}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router]);
  return null;
}
