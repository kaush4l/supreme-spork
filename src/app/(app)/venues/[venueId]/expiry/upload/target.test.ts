import { expect, test } from "bun:test";
import { uploadTarget } from "./target";

const V = "0a837474-c747-417e-acf9-85458b6d0505";

test("reads the venue from the upload path", () => {
  expect(uploadTarget(`/venues/${V}/expiry/upload`)).toEqual({ venueId: V });
});

test("refuses any other path", () => {
  expect(uploadTarget(`/venues/${V}/expiry`)).toBeNull();
  expect(uploadTarget(`/venues/nope/expiry/upload`)).toBeNull();
  expect(uploadTarget(`/venues/${V}/lists/x/photo`)).toBeNull();
});
