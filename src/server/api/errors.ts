/**
 * One error type for every failed backend call. The backend answers `{error: {code, message, field}}` (new routes) or
 * FastAPI's `{detail: "..."}` (older routes, and 401/403/422 from the framework), and sometimes plain text (a 413 from
 * the body limit). Only text meant for a person is ever kept; anything else becomes a generic sentence for the status.
 */
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    field: string | null = null,
  ) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.code = code;
    this.field = field;
  }

  /** The person must sign in again. */
  get needsSignIn(): boolean {
    return this.status === 401;
  }
}

const GENERIC: Record<number, string> = {
  400: "That request could not be understood.",
  401: "Please sign in again.",
  403: "You do not have access to that.",
  404: "We cannot find that.",
  409: "That conflicts with something already saved.",
  413: "That file is too large.",
  422: "Check the details and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  503: "A service we depend on is not reachable. Please try again shortly.",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function toApiFailure(status: number, body: unknown): ApiFailure {
  const generic =
    GENERIC[status] ??
    (status >= 500
      ? "Something went wrong on our side. Please try again."
      : "That did not work.");
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.message === "string"
  ) {
    const { code, message, field } = body.error;
    return new ApiFailure(
      status,
      typeof code === "string" ? code : "error",
      message,
      typeof field === "string" ? field : null,
    );
  }
  if (isRecord(body) && typeof body.detail === "string") {
    return new ApiFailure(status, "error", body.detail);
  }
  if (isRecord(body) && Array.isArray(body.detail)) {
    // FastAPI's validation list: name the first field, never echo the submitted values.
    const first = body.detail.find(isRecord);
    const loc =
      first && Array.isArray(first.loc)
        ? first.loc.filter((part) => typeof part === "string").pop()
        : undefined;
    return new ApiFailure(
      status,
      "validation_error",
      generic,
      typeof loc === "string" ? loc : null,
    );
  }
  return new ApiFailure(status, "error", generic);
}
