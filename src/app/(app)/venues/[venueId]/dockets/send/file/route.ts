import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";
import { uploadTarget } from "./target";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * The browser sends the (resized) photo or the PDF here, never to the backend. It is forwarded to the docket upload,
 * which staff, managers, owners and partners may use. Answers `{document_id, created}`: `created` is false when the
 * same file was already held.
 */
export const POST = handler(async (request, principal) => {
  const target = uploadTarget(new URL(request.url).pathname);
  if (!target) throw new ApiFailure(404, "not_found", "We cannot find that.");
  const incoming = await request.formData();
  const file = incoming.get("file");
  const ok =
    file instanceof File &&
    (file.type.startsWith("image/") || file.type === "application/pdf");
  if (!ok)
    throw new ApiFailure(
      422,
      "not_a_photo",
      "Choose a photo or a PDF of the docket.",
      "file",
    );
  if (file.size > MAX_BYTES)
    throw new ApiFailure(413, "file_too_large", "That file is too large.");
  const form = new FormData();
  form.append("file", file, file.name || "docket");
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/dockets/upload",
    {
      params: { path: { venue_id: target.venueId } },
      body: { file: "" },
      bodySerializer: () => form,
    },
  );
  if (error !== undefined || !response.ok)
    throw toApiFailure(response.status, error);
  const body = data as { document_id?: unknown; created?: unknown } | undefined;
  if (
    typeof body?.document_id !== "string" ||
    typeof body.created !== "boolean"
  )
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  return Response.json(
    { document_id: body.document_id, created: body.created },
    { headers: { "Cache-Control": "no-store" } },
  );
});
