/**
 * Every write to the backend carries an `Idempotency-Key`: send a fresh key for each user action and reuse it when the
 * same action is retried, so a repeat returns the first answer and adds nothing. A form generates its key when it is
 * rendered (a hidden field), so a double click or a retry after a dropped connection sends the same one.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function idempotencyHeader(key: string): { "Idempotency-Key": string } {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw new Error("Not a valid idempotency key.");
  return { "Idempotency-Key": key };
}
