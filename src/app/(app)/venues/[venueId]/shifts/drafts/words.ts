import { formatDay, formatSpan } from "@/server/format";

type ReplyLike = {
  response: string;
  reason?: string | null;
  proposed_start?: string | null;
  proposed_end?: string | null;
  decision?: string | null;
  note?: string | null;
};

/** What my answer to a shift of a draft means, in plain words. Null when there is no answer yet. */
export function replyWords(
  reply: ReplyLike | null | undefined,
  timeZone: string,
): string | null {
  if (!reply) return null;
  const because = reply.reason ? ` Reason: ${reply.reason}` : "";
  const manager = reply.note ? ` Your manager wrote: ${reply.note}` : "";
  switch (reply.response) {
    case "accept":
      return "You said you can work this.";
    case "decline":
      return `You said you cannot work this.${because}`;
    case "propose": {
      const asked =
        reply.proposed_start && reply.proposed_end
          ? `${formatDay(reply.proposed_start, timeZone)}, ${formatSpan(reply.proposed_start, reply.proposed_end, timeZone)}`
          : "another time";
      if (reply.decision === "approved")
        return `Your manager agreed to ${asked}.${manager}`;
      if (reply.decision === "rejected")
        return `Your manager did not agree to ${asked}. The shift stays as drafted.${manager}`;
      return `You asked for ${asked}. Waiting for your manager.${because}`;
    }
    case "pickup":
      if (reply.decision === "approved") return "You picked this shift up.";
      if (reply.decision === "rejected")
        return `You did not get this shift.${manager}`;
      return "You asked to pick this shift up. Waiting for your manager.";
    default:
      return null;
  }
}

/** True once the manager has decided the answer: it can no longer be changed. */
export function isSettled(reply: ReplyLike | null | undefined): boolean {
  return Boolean(reply?.decision);
}

/** `2026-11-16T09:00` from a date and a time field, or null when either is not written the expected way. */
export function wallFrom(day: string, time: string): string | null {
  const value = `${day.trim()}T${time.trim()}`;
  return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : null;
}
