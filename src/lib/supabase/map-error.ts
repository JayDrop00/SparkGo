import type { ActionError, ActionErrorCode } from "@/types/action-result";

type SupabaseErrorLike = { message?: string; code?: string; hint?: string };

const safeMessages: Record<string, { code: ActionErrorCode; message: string }> = {
  NOT_AUTHENTICATED: { code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again." },
  NOT_FOUND: { code: "NOT_FOUND", message: "This team or invitation is no longer available." },
  FORBIDDEN: { code: "FORBIDDEN", message: "You don't have permission to do that." },
  INVALID_INPUT: { code: "VALIDATION_ERROR", message: "Check the information and try again." },
  ALREADY_MEMBER: { code: "CONFLICT", message: "That person is already a team member." },
  ALREADY_INVITED: { code: "CONFLICT", message: "There is already a pending invite for that email." },
  LIMIT_REACHED: { code: "CONFLICT", message: "You've reached the limit for this." },
  RATE_LIMITED: { code: "CONFLICT", message: "Too many invitations. Try again later." },
  OWNER_PROTECTED: { code: "CONFLICT", message: "The owner can't be changed or removed. Transfer ownership first." },
  INVALID_STATE: { code: "CONFLICT", message: "This item has already changed. Refresh and try again." },
  INVITE_EXPIRED: { code: "CONFLICT", message: "This invitation is no longer available." },
  EMAIL_NOT_CONFIRMED: { code: "FORBIDDEN", message: "Confirm your email address first." },
  SELF_REVIEW: { code: "FORBIDDEN", message: "You can't review your own completion request." },
};

export function mapSupabaseError(error: SupabaseErrorLike): ActionError {
  const stableCode = Object.keys(safeMessages).find((key) =>
    (error.message ?? "").includes(key),
  );
  if (stableCode) return safeMessages[stableCode];
  return { code: "INTERNAL", message: "Something went wrong. Please try again." };
}
