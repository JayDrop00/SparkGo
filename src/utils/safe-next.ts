/** Only allow same-origin path redirects (blocks open redirects like //evil.com). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return fallback;
}
