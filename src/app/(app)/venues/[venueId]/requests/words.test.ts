import { expect, test } from "bun:test";
import { formatDate, formatDateSpan, requestWord } from "./words";

test("dates without time do not shift with the zone", () => {
  expect(formatDate("2026-11-20")).toContain("20");
  expect(formatDateSpan("2026-11-20", "2026-11-20")).not.toContain(" to ");
  expect(formatDateSpan("2026-11-20", "2026-11-22")).toContain(" to ");
});

test("status words", () => {
  expect(requestWord("pending")).toBe("Waiting for your manager");
  expect(requestWord("weird")).toBe("weird");
});
