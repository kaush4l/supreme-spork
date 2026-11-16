import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { TARGET_KINDS, targetPage } from "./targets";

const BACKEND = "../minder-pass/app/features";

/** Target kinds the backend can send, read from its own source so a new kind there fails this test until it has a path. */
function backendKinds(): string[] {
  const summary = `${BACKEND}/summary/attention.py`;
  const build = `${BACKEND}/attention/build.py`;
  if (!existsSync(summary) || !existsSync(build)) return [];
  const kinds = new Set<string>();
  const table = readFileSync(summary, "utf8").match(
    /TARGETS = \{([\s\S]*?)\n\}/,
  );
  for (const m of table?.[1].matchAll(/"[a-z_]+": "([a-z_]+)"/g) ?? [])
    kinds.add(m[1]);
  for (const m of readFileSync(build, "utf8").matchAll(
    /\{"kind": "([a-z_]+)"/g,
  ))
    kinds.add(m[1]);
  return [...kinds];
}

describe("attention targets", () => {
  test("every kind the backend can send has a page", () => {
    const sent = backendKinds();
    if (sent.length === 0) return; // backend checkout not beside this repo
    expect(sent.length).toBeGreaterThanOrEqual(10);
    const missing = sent.filter((k) => targetPage(k, "x") === null);
    expect(missing).toEqual([]);
  });
  test("the kinds listed here all give a path under the venue", () => {
    for (const kind of TARGET_KINDS) {
      const page = targetPage(kind, "abc");
      expect(page?.path.startsWith("/")).toBe(true);
      expect(page?.nav.length).toBeGreaterThan(0);
    }
  });
  test("a single item leads to its own page", () => {
    expect(targetPage("finding", "f1")?.path).toBe("/findings/f1");
    expect(targetPage("expiry_item", "e1")?.path).toBe("/expiry/e1");
    expect(targetPage("roster_draft", "d1")?.path).toBe("/roster/drafts/d1");
    expect(targetPage("corrective_action", "a1")?.path).toBe("/actions/a1");
    expect(targetPage("corrective_action")?.path).toBe("/actions");
    expect(targetPage("corrective_action")?.nav).toBe("actions");
    expect(targetPage("dockets_queue", null)?.path).toBe("/dockets");
    expect(targetPage("bank_files_review")?.path).toBe("/bank/files");
    expect(targetPage("cash_unconfirmed")?.path).toBe(
      "/cash-book?unconfirmed=true",
    );
    expect(targetPage("cash_unconfirmed")?.nav).toBe("cash-book");
  });
  test("an unknown or missing kind has no page", () => {
    expect(targetPage("zzz")).toBeNull();
    expect(targetPage(undefined)).toBeNull();
    expect(targetPage(null)).toBeNull();
  });
});
