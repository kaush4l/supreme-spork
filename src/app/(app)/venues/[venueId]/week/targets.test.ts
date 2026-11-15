import { describe, expect, test } from "bun:test";
import { targetPage } from "./targets";

describe("attention targets", () => {
  test("known kinds lead to a page and its navigation key", () => {
    expect(targetPage("dockets_queue")).toEqual({
      path: "/dockets",
      nav: "dockets",
    });
    expect(targetPage("bank_files_review")?.path).toBe("/bank/files");
    expect(targetPage("bills_overdue")?.path).toBe("/bills");
    expect(targetPage("bills_due_soon")?.path).toBe("/bills");
    expect(targetPage("checklists_overdue")?.path).toBe("/board");
    expect(targetPage("staff")?.path).toBe("/team");
  });
  test("an unknown or missing kind has no page", () => {
    expect(targetPage("zzz")).toBeNull();
    expect(targetPage(undefined)).toBeNull();
    expect(targetPage(null)).toBeNull();
  });
});
