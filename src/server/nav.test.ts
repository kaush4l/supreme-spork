import { describe, expect, test } from "bun:test";
import { landingPath, mayOpen, navFor } from "./nav";

const staff = { roles: ["staff"], rights: [] };
const manager = {
  roles: ["manager"],
  rights: [
    "roster.build",
    "roster.requests.decide",
    "timesheet.view",
    "staff.invite",
  ],
};
const owner = {
  roles: ["owner"],
  rights: [
    "roster.build",
    "roster.requests.decide",
    "timesheet.view",
    "staff.manage",
  ],
};
const bookkeeper = { roles: ["bookkeeper"], rights: [] };

const keys = (me: Parameters<typeof navFor>[0]) =>
  navFor(me).flatMap((s) => s.items.map((i) => i.key));

describe("navigation by role and rights", () => {
  test("staff see their own work and nothing to run the venue", () => {
    expect(keys(staff)).toEqual([
      "today",
      "shifts",
      "lists",
      "requests",
      "pay",
      "notices",
      "announcements",
      "my-cash",
      "waste",
      "docket-send",
    ]);
    expect(mayOpen(staff, "dockets")).toBe(false);
    expect(mayOpen(staff, "week")).toBe(false);
    expect(mayOpen(staff, "board")).toBe(false);
    expect(mayOpen(staff, "roster")).toBe(false);
  });
  test("a manager also gets the venue pages their rights allow", () => {
    expect(keys(manager)).toContain("board");
    expect(keys(manager)).toContain("approvals");
    expect(keys(manager)).toContain("team");
    expect(mayOpen(manager, "settings")).toBe(false);
  });
  test("a manager without the roster right does not see the roster", () => {
    const m = { roles: ["manager"], rights: [] };
    expect(mayOpen(m, "roster")).toBe(false);
    expect(mayOpen(m, "board")).toBe(true);
  });
  test("owners, partners and managers get Follow-ups next to the readings log; staff and bookkeepers do not", () => {
    for (const me of [manager, owner, { ...owner, roles: ["partner"] }]) {
      const k = keys(me);
      expect(k).toContain("actions");
      expect(k.indexOf("actions")).toBe(k.indexOf("readings") + 1);
      expect(mayOpen(me, "actions")).toBe(true);
    }
    expect(mayOpen(staff, "actions")).toBe(false);
    expect(mayOpen(bookkeeper, "actions")).toBe(false);
    expect(
      navFor(manager)
        .flatMap((s) => s.items)
        .find((i) => i.key === "actions"),
    ).toEqual({ key: "actions", label: "Follow-ups", path: "/actions" });
  });
  test("an owner gets settings and the rules page", () => {
    expect(mayOpen(owner, "settings")).toBe(true);
    expect(mayOpen(owner, "rules")).toBe(true);
  });
  test("a bookkeeper has no shift pages", () => {
    expect(mayOpen(bookkeeper, "today")).toBe(false);
    expect(keys(bookkeeper)).toEqual([
      "attention",
      "week",
      "messages",
      "dockets",
      "suppliers",
      "sales-files",
      "recipes",
      "waste",
    ]);
  });
  test("the money pages follow the rights the backend sends", () => {
    const b = {
      roles: ["bookkeeper"],
      rights: ["money.pnl.view", "money.cash", "money.exports"],
    };
    expect(keys(b)).toEqual([
      "attention",
      "week",
      "messages",
      "dockets",
      "suppliers",
      "sales-files",
      "recipes",
      "waste",
      "pnl",
      "bills",
      "bank",
      "cash-book",
      "downloads",
    ]);
    expect(mayOpen(manager, "pnl")).toBe(false);
    expect(mayOpen(manager, "dockets")).toBe(true);
    expect(mayOpen({ ...manager, rights: ["expiry.manage"] }, "expiry")).toBe(
      true,
    );
  });
  test("waste is listed once: with a person's own work, or with the stock pages", () => {
    const onTeam = { ...manager, has_staff_profile: true };
    const offTeam = { ...owner, has_staff_profile: false };
    expect(keys(onTeam).filter((k) => k === "waste")).toHaveLength(1);
    expect(keys(offTeam).filter((k) => k === "waste")).toHaveLength(1);
    expect(mayOpen(onTeam, "docket-send")).toBe(false);
  });
  test("an owner who is not on the team has no shift pages, one who is does", () => {
    expect(mayOpen({ ...owner, has_staff_profile: false }, "today")).toBe(
      false,
    );
    expect(mayOpen({ ...owner, has_staff_profile: true }, "today")).toBe(true);
    expect(landingPath({ ...owner, has_staff_profile: false })).toBe(
      "/attention",
    );
  });
  test("a manager can open change requests (to withdraw their own), an owner has them under Owner", () => {
    expect(mayOpen(manager, "changes")).toBe(true);
    expect(keys(owner).filter((k) => k === "changes")).toHaveLength(1);
  });
  test("the landing page is the first one in the navigation", () => {
    expect(landingPath(staff)).toBe("/today");
    expect(landingPath(manager)).toBe("/attention");
    expect(landingPath(owner)).toBe("/attention");
    expect(landingPath({ ...owner, roles: ["partner"] })).toBe("/attention");
    expect(landingPath(bookkeeper)).toBe("/week");
  });
  test("needs attention is first for everyone who reads the books, and not for staff", () => {
    for (const me of [manager, owner, bookkeeper])
      expect(navFor(me)[0].items[0].key).toBe("attention");
    expect(mayOpen(staff, "attention")).toBe(false);
    expect(keys(manager).filter((k) => k === "attention")).toHaveLength(1);
  });
});
