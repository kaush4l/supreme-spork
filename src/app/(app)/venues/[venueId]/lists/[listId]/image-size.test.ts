import { expect, test } from "bun:test";
import { fitWithin } from "./image-size";

test("a large landscape photo is cut to 1600 on the long side", () => {
  expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
});
test("a large portrait photo keeps its shape", () => {
  expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
});
test("a small photo is never enlarged", () => {
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
});
test("a very thin photo never reaches zero", () => {
  expect(fitWithin(10000, 1)).toEqual({ width: 1600, height: 1 });
});
test("nonsense sizes give 1 by 1", () => {
  expect(fitWithin(0, 100)).toEqual({ width: 1, height: 1 });
});
