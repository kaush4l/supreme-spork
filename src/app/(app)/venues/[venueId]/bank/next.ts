/** Where to go after a question is dealt with: the next open question, or the list when none is left. */
export function afterQuestionHref(
  venueId: string,
  nextId: string | null,
): string {
  return nextId
    ? `/venues/${venueId}/bank/${nextId}`
    : `/venues/${venueId}/bank`;
}

/** The first open question that is not the one just closed (the list is oldest first, as the API sends it). */
export function pickNext(openIds: string[], justClosed: string): string | null {
  return openIds.find((id) => id !== justClosed) ?? null;
}
