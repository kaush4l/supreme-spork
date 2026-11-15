import { expect, test } from "bun:test";
import { daysWords } from "./words";

test("days in plain words", () => {
  expect(daysWords(13)).toBe("13 days left");
  expect(daysWords(1)).toBe("1 day left");
  expect(daysWords(0)).toBe("runs out today");
  expect(daysWords(-16)).toBe("ran out 16 days ago");
});
