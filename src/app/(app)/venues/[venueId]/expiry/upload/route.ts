import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";
import { uploadTarget } from "./target";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * The browser sends the file for a licence or HR item here (never to the backend). `?scope=person` is an HR file; the
 * backend refuses it for anyone without the right. Answers `{document_id}`; name that in the item.
 */
export const POST = handler(async (request, principal) => {
  const url = new URL(request.url);
  const target = uploadTarget(url.pathname);
  if (!target) throw new ApiFailure(404, "not_found", "We cannot find that.");
  const scope = url.searchParams.get("scope") === "person" ? "person" : "venue";
  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File))
    throw new ApiFailure(422, "no_file", "Choose a file to upload.", "file");
  if (file.size > MAX_BYTES)
    throw new ApiFailure(413, "file_too_large", "That file is too large.");
  const form = new FormData();
  form.append("file", file, file.name || "file");
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/expiry-items/files",
    {
      params: { path: { venue_id: target.venueId }, query: { scope } },
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
