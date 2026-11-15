import { describe, expect, test } from "bun:test";
import { changesFrom, fromDraft, toDraft } from "./rule-values";

const hours = { kind: "choice", value: 48 } as const;
const rest = { kind: "number_or_off", value: 10, min: 1, max: 24 } as const;

describe("rule values", () => {
  test("choices keep their type", () => {
    expect(toDraft(hours)).toBe("48");
    expect(fromDraft(hours, "48")).toBe(48);
    expect(fromDraft(hours, '"none"')).toBe("none");
    expect(fromDraft({ kind: "yesno", value: true }, "false")).toBe(false);
  });
  test("numbers are checked against the range", () => {
    expect(fromDraft(rest, "12")).toBe(12);
    expect(fromDraft(rest, "off")).toBe("off");
    expect(fromDraft(rest, "30")).toBe("invalid");
    expect(fromDraft(rest, "1.5")).toBe("invalid");
    expect(fromDraft({ kind: "number", value: 5, min: 0, max: 9 }, "off")).toBe(
      "invalid",
    );
  });
  test("only changed rules are sent", () => {
    const rules = [
      { key: "a", ...hours },
      { key: "b", ...rest },
    ];
    expect(changesFrom(rules, { a: "48", b: "off" })).toEqual({
      changes: { b: "off" },
      bad: [],
    });
    expect(changesFrom(rules, { b: "99" }).bad).toEqual(["b"]);
  });
});
