import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";
import { photoTarget } from "./target";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * The browser sends the resized photo here (never to the backend). It is forwarded to the manager upload, which
 * takes a photo for any list. Answers `{document_id}`; name that in the item's answer.
 */
export const POST = handler(async (request, principal) => {
  const target = photoTarget(new URL(request.url).pathname);
  if (!target) throw new ApiFailure(404, "not_found", "We cannot find that.");
  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/"))
    throw new ApiFailure(
      422,
      "not_a_photo",
      "Choose a photo to upload.",
      "file",
    );
  if (file.size > MAX_PHOTO_BYTES)
    throw new ApiFailure(413, "file_too_large", "That photo is too large.");
  const form = new FormData();
  form.append("file", file, file.name || "photo.jpg");
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/workflows/lists/{list_id}/photo",
    {
      params: { path: { venue_id: target.venueId, list_id: target.listId } },
      body: { file: "" },
      bodySerializer: () => form,
    },
  );
  if (error !== undefined || !response.ok)
    throw toApiFailure(response.status, error);
  const id = (data as { document_id?: unknown } | undefined)?.document_id;
  if (typeof id !== "string")
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  return Response.json(
    { document_id: id },
    { headers: { "Cache-Control": "no-store" } },
  );
});
