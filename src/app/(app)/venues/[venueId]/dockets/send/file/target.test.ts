import { expect, test } from "bun:test";
import { uploadTarget } from "./target";

const id = "49428452-f9f3-4c2d-948c-68a42da41ad3";

test("names the venue", () => {
  expect(uploadTarget(`/venues/${id}/dockets/send/file`)).toEqual({
    venueId: id,
  });
});

test("anything else is null", () => {
  expect(uploadTarget(`/venues/${id}/dockets/send`)).toBeNull();
  expect(uploadTarget("/venues/x/dockets/send/file")).toBeNull();
  expect(uploadTarget(`/venues/${id}/lists/send/file`)).toBeNull();
});
