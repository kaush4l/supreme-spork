import { expect, test } from "bun:test";
import { canDecide, canSend, statusTone } from "./words";

const me = (...roles: string[]) => ({ roles, rights: [] });

test("who may decide and who may send", () => {
  expect(canDecide(me("manager"))).toBe(true);
  expect(canDecide(me("bookkeeper"))).toBe(false);
  expect(canDecide(me("staff"))).toBe(false);
  expect(canSend(me("staff"))).toBe(true);
  expect(canSend(me("owner"))).toBe(true);
  expect(canSend(me("bookkeeper"))).toBe(false);
});

test("status tone", () => {
  expect(statusTone("booked")).toBe("success");
  expect(statusTone("rejected")).toBe("neutral");
  expect(statusTone("needs_check")).toBe("warning");
});
