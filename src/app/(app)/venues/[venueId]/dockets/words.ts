import { isManager, type Rights } from "@/server/nav";

/** Owner, partner and manager decide dockets; the bookkeeper only reads. */
export function canDecide(me: Rights): boolean {
  return isManager(me);
}

/** The roles the backend lets send a docket photo: the three that decide, and staff. Not the bookkeeper. */
export function canSend(me: Rights): boolean {
  return isManager(me) || me.roles.includes("staff");
}

/** `ok` for a docket that is booked, `warning` while a person has to act, `neutral` for a set-aside one. */
export function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "booked") return "success";
  if (status === "rejected") return "neutral";
  return "warning";
}
