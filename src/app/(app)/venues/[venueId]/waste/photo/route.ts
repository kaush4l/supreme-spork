import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The venue named in `/venues/{venueId}/waste/photo`, or null if the path is anything else. */
function venueOf(pathname: string): string | null {
  const m = pathname.split("/").filter(Boolean);
  if (
    m.length !== 4 ||
    m[0] !== "venues" ||
    m[2] !== "waste" ||
    m[3] !== "photo"
  )
    return null;
  return UUID.test(m[1] ?? "") ? (m[1] ?? null) : null;
}

/**
 * The browser sends the resized photo here (never to the backend). It is forwarded to the waste photo upload.
 * Answers `{document_id}`; name that in the entry.
 */
export const POST = handler(async (request, principal) => {
  const venueId = venueOf(new URL(request.url).pathname);
  if (!venueId) throw new ApiFailure(404, "not_found", "We cannot find that.");
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
  form.append("file", file, file.name || "waste.jpg");
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/waste/photo",
    {
      params: { path: { venue_id: venueId } },
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
