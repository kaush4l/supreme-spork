import { describe, expect, test } from "bun:test";
import { groupTitle } from "./rows";

describe("source rows", () => {
  test("an unknown group keeps its own name", () => {
    expect(groupTitle("zzz")).toBe("zzz");
    expect(groupTitle("shifts")).toBe("Shifts");
  });
});
