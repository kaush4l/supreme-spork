import { describe, expect, test } from "bun:test";
import { linkWords, noticeHref, targetOf } from "./href";

const staff = { roles: ["staff"], rights: [], has_staff_profile: true };
const manager = {
  roles: ["manager"],
  rights: ["roster.build", "roster.requests.decide", "timesheet.view"],
  has_staff_profile: true,
};
const owner = {
  roles: ["owner"],
  rights: ["roster.build", "roster.requests.decide"],
  has_staff_profile: false,
};
const bookkeeper = {
  roles: ["bookkeeper"],
  rights: [],
  has_staff_profile: false,
};

describe("noticeHref", () => {
  test("an offer opens its own page for a person who works shifts", () => {
    expect(noticeHref({ kind: "offer", id: "o1" }, staff)).toBe(
      "/shifts/offers/o1",
    );
    expect(noticeHref({ kind: "offer", id: null }, staff)).toBeNull();
    expect(noticeHref({ kind: "offer", id: "o1" }, bookkeeper)).toBeNull();
  });
  test("a draft goes to my shifts for the person who replies, to the roster draft otherwise", () => {
    expect(noticeHref({ kind: "roster_draft", id: "d1" }, staff)).toBe(
      "/shifts/drafts",
    );
    expect(noticeHref({ kind: "roster_draft", id: "d1" }, owner)).toBe(
      "/roster/drafts/d1",
    );
    expect(
      noticeHref({ kind: "roster_draft", id: "d1" }, bookkeeper),
    ).toBeNull();
  });
  test("a request goes to approvals for who decides and to requests for its owner", () => {
    const t = { kind: "roster_request", id: "r1" };
    expect(noticeHref(t, manager, "request_made")).toBe("/approvals");
    expect(noticeHref(t, staff, "request_made")).toBe("/requests");
    expect(noticeHref(t, staff, "request_decided")).toBe("/requests");
    expect(noticeHref(t, manager, "request_decided")).toBe("/requests");
    expect(noticeHref(t, owner, "request_decided")).toBe("/approvals");
    expect(noticeHref(t, bookkeeper)).toBeNull();
  });
  test("a checklist goes to the board for a manager and to my checklists for staff", () => {
    const t = { kind: "checklist", id: "l1" };
    expect(noticeHref(t, manager)).toBe("/board/l1");
    expect(noticeHref(t, staff)).toBe("/lists/l1");
    expect(noticeHref(t, bookkeeper)).toBeNull();
    expect(noticeHref({ kind: "checklist", id: null }, staff)).toBeNull();
  });
  test("a change request goes to changes only where the nav has it", () => {
    const t = { kind: "change_request", id: "c1" };
    expect(noticeHref(t, manager)).toBe("/changes");
    expect(noticeHref(t, owner)).toBe("/changes");
    expect(noticeHref(t, staff)).toBeNull();
  });
  test("a shift goes to my shifts", () => {
    expect(noticeHref({ kind: "shift", id: "s1" }, staff)).toBe("/shifts");
    expect(noticeHref({ kind: "shift", id: "s1" }, owner)).toBeNull();
  });
  test("none, unknown and missing targets have no link", () => {
    expect(noticeHref({ kind: "none", id: null }, staff)).toBeNull();
    expect(noticeHref({ kind: "zzz", id: "x" }, staff)).toBeNull();
    expect(noticeHref(undefined, staff)).toBeNull();
    expect(noticeHref(null, staff)).toBeNull();
  });
});

describe("targetOf", () => {
  test("uses the target, else the old list id", () => {
    expect(targetOf({ target: { kind: "offer", id: "o" } })).toEqual({
      kind: "offer",
      id: "o",
    });
    expect(targetOf({ issued_list_id: "l" })).toEqual({
      kind: "checklist",
      id: "l",
    });
    expect(targetOf({ target: null, issued_list_id: null })).toBeNull();
  });
});

test("link words", () => {
  expect(linkWords(true)).toBe("Open");
  expect(linkWords(false)).toBe("See what happened");
});
