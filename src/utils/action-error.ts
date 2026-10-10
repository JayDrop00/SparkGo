import { flattenError, ZodError } from "zod";
import type { ActionError, ActionErrorCode } from "@/types/action-result";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

const SQLSTATE_TO_CODE: Record<string, ActionErrorCode> = {
  "23505": "CONFLICT",
  "23503": "NOT_FOUND",
  "P0002": "NOT_FOUND",
  "28000": "UNAUTHENTICATED",
  "22023": "VALIDATION_ERROR",
  "22P02": "VALIDATION_ERROR",
};

function humanize(message: string): string {
  return message
    .replace(/_[a-z]/g, (match) => ` ${match.slice(1).toUpperCase()}`)
    .replace(/^./, (char) => char.toUpperCase());
}

export function toActionError(error: unknown): ActionError {
  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(error),
    };
  }

  const maybe = error as SupabaseErrorLike | null;
  const code = typeof maybe?.code === "string" ? maybe.code : undefined;
  const message = typeof maybe?.message === "string" ? maybe.message : "";

  if (code === "23505") {
    const match = message.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const value = match?.[2];
    return {
      code: "CONFLICT",
      message: value
        ? `You already have an item named "${value}".`
        : "That name is already taken.",
    };
  }

  if (message.toLowerCase().includes("not authenticated")) {
    return { code: "UNAUTHENTICATED", message: "Your session has expired." };
  }

  const mapped = code ? SQLSTATE_TO_CODE[code] : undefined;
  if (mapped) {
    return {
      code: mapped,
      message:
        mapped === "VALIDATION_ERROR"
          ? humanize(message || "Invalid value.")
          : mapped === "NOT_FOUND"
            ? "The item no longer exists."
            : "Your session has expired.",
    };
  }

  console.error("[action:error]", error);
  return {
    code: "INTERNAL",
    message: "Something went wrong. Please try again.",
  };
}

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const { fieldErrors } = flattenError(error) as {
    fieldErrors: Record<string, string[] | undefined>;
  };
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value && value.length > 0) result[key] = value;
  }
  return result;
}
