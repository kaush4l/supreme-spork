import { describe, expect, test } from "bun:test";
import { linkAllowed, resolveHref } from "./links";

describe("resolveHref", () => {
  test("docket drill-down keeps status and date filters and adds venue", () => {
    expect(
      resolveHref(
        "owner",
        "v-harbour",
        "dockets?from=2026-11-09&to=2026-11-15",
      ),
    ).toBe(
      "/proto/owner/money/dockets?from=2026-11-09&to=2026-11-15&venue=v-harbour",
    );
    expect(resolveHref("owner", "v-perth", "dockets?status=needs_review")).toBe(
      "/proto/owner/money/dockets?status=needs_review&venue=v-perth",
    );
  });
  test("weekly finance goes to money overview with the same week", () => {
    expect(
      resolveHref("owner", "v-harbour", "money/weekly?week=2026-11-09"),
    ).toBe(
      "/proto/owner/money/overview?view=week&week=2026-11-09&venue=v-harbour",
    );
    expect(
      resolveHref("owner", "v-harbour", "money/labour?week=2026-11-09"),
    ).toContain("view=labour&week=2026-11-09");
  });
  test("view all attention opens the inbox action tab for the venue", () => {
    expect(resolveHref("owner", "v-perth", "attention")).toBe(
      "/proto/owner/inbox?tab=action&scope=urgent&venue=v-perth",
    );
  });
  test("roster and operations targets", () => {
    expect(resolveHref("manager", "v-harbour", "roster?filter=open")).toBe(
      "/proto/manager/team/roster?filter=open&venue=v-harbour",
    );
    expect(
      resolveHref("manager", "v-harbour", "operations/checks?status=failed"),
    ).toBe(
      "/proto/manager/operations?kind=checks&status=failed&venue=v-harbour",
    );
  });
  test("obligation hash is kept", () => {
    expect(
      resolveHref("owner", "v-harbour", "money/obligations#ob-1"),
    ).toEndWith("#ob-1");
  });
});

describe("linkAllowed", () => {
  test("manager without money rights may not link to money", () => {
    const u = resolveHref("manager", "v-harbour", "dockets?status=new");
    expect(linkAllowed("manager", "management", u)).toBe(false);
  });
  test("manager with money rights may", () => {
    const u = resolveHref("manager-money", "v-harbour", "dockets");
    expect(linkAllowed("manager-money", "management", u)).toBe(true);
  });
});
