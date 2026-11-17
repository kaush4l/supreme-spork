import { describe, expect, test } from "bun:test";
import { filterOps, opsRecordsFor, parseOpsFilter } from "./ops-data";

describe("ops filters", () => {
  test("failed checks for the venue", () => {
    const f = parseOpsFilter(new URLSearchParams("kind=checks&status=failed"));
    const rows = filterOps(opsRecordsFor("v-harbour"), f);
    expect(rows.map((r) => r.id)).toEqual(["c-12", "c-13"]);
  });
  test("unknown values are ignored, not trusted", () => {
    expect(parseOpsFilter(new URLSearchParams("kind=x&status=y"))).toEqual({});
  });
  test("id narrows to one record", () => {
    const f = parseOpsFilter(new URLSearchParams("id=e-4"));
    expect(filterOps(opsRecordsFor("v-harbour"), f)).toHaveLength(1);
  });
  test("empty venue has no records", () => {
    expect(opsRecordsFor("v-empty")).toEqual([]);
  });
  test("the issue group relates c-12 e-4 d-2 explicitly", () => {
    const issue = opsRecordsFor("v-harbour").find((r) => r.kind === "issues");
    expect(issue?.relatedIds).toEqual(["c-12", "e-4", "d-2"]);
  });
});
