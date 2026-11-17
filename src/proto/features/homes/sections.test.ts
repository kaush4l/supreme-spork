import { describe, expect, test } from "bun:test";
import type { SectionResult } from "../../types";
import { effectiveScenario, pickSection, sectionFor } from "./sections";

const err: SectionResult<number> = { status: "error", message: "x" };
const ok: SectionResult<number> = { status: "ok", data: 1 };

describe("pickSection", () => {
  test("not ready is loading for every section", () => {
    expect(pickSection(false, ok, ok, false).status).toBe("loading");
  });
  test("failed section stays failed until retried, then recovers", () => {
    expect(pickSection(true, err, ok, false).status).toBe("error");
    expect(pickSection(true, err, ok, true).status).toBe("ok");
  });
  test("a sibling that did not fail is unaffected by retry flag", () => {
    expect(pickSection(true, ok, err, true)).toEqual(ok);
  });
});

describe("scenarios", () => {
  test("released loading becomes default", () => {
    expect(effectiveScenario("loading", true)).toBe("default");
    expect(effectiveScenario("loading", false)).toBe("loading");
    expect(effectiveScenario("partial", true)).toBe("partial");
  });
  test("sectionFor", () => {
    expect(sectionFor("denied", () => 1).status).toBe("denied");
    expect(sectionFor("default", () => 1).status).toBe("ok");
  });
});
