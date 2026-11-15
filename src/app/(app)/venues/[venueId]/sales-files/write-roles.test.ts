import { expect, test } from "bun:test";
import { mayWriteSales } from "./write-roles";

test("owner, partner and manager write; bookkeeper and staff do not", () => {
  expect(mayWriteSales(["owner"])).toBe(true);
  expect(mayWriteSales(["staff", "manager"])).toBe(true);
  expect(mayWriteSales(["partner"])).toBe(true);
  expect(mayWriteSales(["bookkeeper"])).toBe(false);
  expect(mayWriteSales([])).toBe(false);
});
