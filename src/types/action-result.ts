export type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };
