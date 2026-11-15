/** Who may do what with waste (the backend decides; this only hides buttons). Pure. */
const ANY = ["owner", "partner", "manager"];
const MONEY = [...ANY, "bookkeeper"];
const ENTER = [...ANY, "staff"];

const has = (roles: readonly string[], allowed: readonly string[]) =>
  roles.some((r) => allowed.includes(r));

/** Record waste: owner, partner, manager and staff (not the bookkeeper). */
export const mayEnter = (roles: readonly string[]) => has(roles, ENTER);
/** See everyone's entries (staff see only their own). */
export const seesEveryone = (roles: readonly string[]) => has(roles, MONEY);
/** The cost report: everyone but staff. */
export const mayReadReport = (roles: readonly string[]) => has(roles, MONEY);

/** Change or remove: managers and up for any entry, staff only for what they entered (`mine` from the API), the bookkeeper never. */
export function mayChange(roles: readonly string[], mine: boolean): boolean {
  if (has(roles, ANY)) return true;
  return roles.includes("staff") && mine;
}

/** "2 kg, spoiled" / "3 portions, dropped". The quantity is shown as the API sent it. */
export function entryLine(e: {
  qty: number;
  unit: string;
  item_kind: string | null;
  reason_label: string;
}): string {
  const unit =
    e.item_kind === "menu_item"
      ? e.qty === 1
        ? "portion"
        : "portions"
      : e.unit;
  return `${e.qty} ${unit}, ${e.reason_label.toLowerCase()}`;
}
