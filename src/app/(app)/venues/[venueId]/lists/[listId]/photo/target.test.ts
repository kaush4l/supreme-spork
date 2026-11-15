import { expect, test } from "bun:test";
import { photoTarget } from "./target";

const v = "11111111-1111-4111-8111-111111111111";
const l = "22222222-2222-4222-8222-222222222222";

test("reads the venue and list", () => {
  expect(photoTarget(`/venues/${v}/lists/${l}/photo`)).toEqual({
    venueId: v,
    listId: l,
  });
});
test("refuses anything else", () => {
  expect(photoTarget(`/venues/${v}/lists/${l}`)).toBeNull();
  expect(photoTarget(`/venues/x/lists/${l}/photo`)).toBeNull();
  expect(photoTarget(`/venues/${v}/lists/${l}/photo/extra`)).toBeNull();
  expect(photoTarget(`/venues/${v}/lists/../photo`)).toBeNull();
});
