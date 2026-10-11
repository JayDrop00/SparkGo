// DEBUG: enable with NEXT_PUBLIC_DEBUG_TEAMS=true in .env.local ONLY; unset in production.
const ENABLED = process.env.NEXT_PUBLIC_DEBUG_TEAMS === "true";
const SENSITIVE = /email|token|note|password|cookie|authorization/i;

function redact(data?: Record<string, unknown>) {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, SENSITIVE.test(key) ? "[redacted]" : value]),
  );
}

export function dbg(scope: string, message: string, data?: Record<string, unknown>) {
  if (!ENABLED) return;
  console.debug(`[sparkgo:${scope}] ${message}`, redact(data));
}
