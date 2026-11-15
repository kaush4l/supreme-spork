import { expect, test } from "bun:test";
import { afterQuestionHref, pickNext } from "./next";

test("pickNext skips the question just closed", () => {
  expect(pickNext(["a", "b"], "a")).toBe("b");
  expect(pickNext(["b", "c"], "a")).toBe("b");
  expect(pickNext(["a"], "a")).toBeNull();
  expect(pickNext([], "a")).toBeNull();
});

test("afterQuestionHref goes on or back to the list", () => {
  expect(afterQuestionHref("v", "q")).toBe("/venues/v/bank/q");
  expect(afterQuestionHref("v", null)).toBe("/venues/v/bank");
});
