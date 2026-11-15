/**
 * What a person sees in the navigation, from their roles and rights at one venue (`GET /me/rights`). Pure, so it is
 * tested without a browser. This only decides what to show: the backend still checks every request itself.
 */
export type Rights = {
  roles: readonly string[];
  rights: readonly string[];
  /** From the backend; when it is missing, a role other than a lone bookkeeper is taken to work shifts. */
  has_staff_profile?: boolean;
};

export type NavItem = {
  key: string;
  label: string;
  /** Path under `/venues/{id}`, empty for the venue's own home. */
  path: string;
};

export type NavSection = { title: string; items: NavItem[] };

const MANAGER_ROLES = ["owner", "partner", "manager"];

export function can(me: Rights, right: string): boolean {
  return me.rights.includes(right);
}

export function isManager(me: Rights): boolean {
  return me.roles.some((role) => MANAGER_ROLES.includes(role));
}

export function isOwnerLike(me: Rights): boolean {
  return me.roles.some((role) => role === "owner" || role === "partner");
}

/** Whether the person works shifts here: they are on the team (an owner who only runs the place is not). */
export function worksShifts(me: Rights): boolean {
  if (me.has_staff_profile !== undefined) return me.has_staff_profile;
  return me.roles.some((role) => role !== "bookkeeper");
}

export function navFor(me: Rights): NavSection[] {
  const sections: NavSection[] = [];
  if (worksShifts(me)) {
    sections.push({
      title: "My work",
      items: [
        { key: "today", label: "Today", path: "/today" },
        { key: "shifts", label: "My shifts", path: "/shifts" },
        { key: "lists", label: "My checklists", path: "/lists" },
        { key: "requests", label: "Requests", path: "/requests" },
        { key: "pay", label: "My hours", path: "/pay" },
        { key: "notices", label: "Notices", path: "/notices" },
      ],
    });
  }
  const manage: NavItem[] = [];
  if (isManager(me)) {
    manage.push({ key: "board", label: "Today board", path: "/board" });
  }
  if (can(me, "roster.build")) {
    manage.push({ key: "roster", label: "Roster", path: "/roster" });
  }
  if (can(me, "roster.requests.decide")) {
    manage.push({ key: "approvals", label: "Approvals", path: "/approvals" });
  }
  if (isManager(me)) {
    manage.push({
      key: "checklists",
      label: "Checklist setup",
      path: "/checklists",
    });
  }
  if (can(me, "timesheet.view")) {
    manage.push({ key: "timesheet", label: "Timesheet", path: "/timesheet" });
  }
  if (can(me, "staff.manage") || can(me, "staff.invite")) {
    manage.push({ key: "team", label: "Team", path: "/team" });
  }
  if (isManager(me) && !isOwnerLike(me)) {
    manage.push({ key: "changes", label: "Change requests", path: "/changes" });
  }
  if (manage.length > 0)
    sections.push({ title: "Running the venue", items: manage });
  if (isOwnerLike(me)) {
    sections.push({
      title: "Owner",
      items: [
        { key: "settings", label: "Settings", path: "/settings" },
        { key: "rules", label: "Who can do what", path: "/rules" },
        { key: "changes", label: "Change requests", path: "/changes" },
      ],
    });
  }
  return sections;
}

/** The first page for this person: the board for a manager, otherwise their own day. */
export function landingPath(me: Rights): string {
  if (isManager(me)) return "/board";
  return navFor(me)[0]?.items[0]?.path ?? "";
}

/** A page is open to the person when it is in their navigation (the page itself still asks the backend). */
export function mayOpen(me: Rights, key: string): boolean {
  return navFor(me).some((s) => s.items.some((i) => i.key === key));
}
