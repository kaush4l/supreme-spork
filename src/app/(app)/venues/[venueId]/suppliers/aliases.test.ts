import { expect, test } from "bun:test";
import { aliasesText, parseAliases } from "./aliases";

test("splits on lines and commas, trims, drops blanks and repeats", () => {
  expect(
    parseAliases(" Harbour Fish, Harbour Fish Co\n\n HARBOUR ,Harbour Fish"),
  ).toEqual(["Harbour Fish", "Harbour Fish Co", "HARBOUR"]);
});

test("empty text gives no aliases", () => {
  expect(parseAliases("  \n ,")).toEqual([]);
});

test("round trips through the text box", () => {
  expect(parseAliases(aliasesText(["A b", "C"]))).toEqual(["A b", "C"]);
});
