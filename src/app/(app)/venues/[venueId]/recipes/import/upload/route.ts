import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { importAnswerSchema } from "@/server/data/recipes";
import { handler } from "@/server/handler";

const MAX_BYTES = 5 * 1024 * 1024;

/** The browser sends a recipes CSV here, never to the backend. It is forwarded as it is and loaded at once. */
export const POST = handler(async (request, principal) => {
  const venueId = new URL(request.url).pathname.split("/")[2] ?? "";
  if (!z.uuid().safeParse(venueId).success)
    throw new ApiFailure(404, "not_found", "We cannot find that.");
  const incoming = await request.formData();
  const file = incoming.get("file");
  const key = incoming.get("key");
  if (!(file instanceof File) || !/\.csv$/i.test(file.name))
    throw new ApiFailure(
      422,
      "not_a_csv",
      "Choose the recipes as a CSV file.",
      "file",
    );
  if (file.size > MAX_BYTES)
    throw new ApiFailure(413, "file_too_large", "That file is too large.");
  const form = new FormData();
  form.append("file", file, file.name);
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/recipes/import-file",
    {
      params: { path: { venue_id: venueId } },
      body: { file: "" },
      bodySerializer: () => form,
      ...(typeof key === "string" && key
        ? { headers: idempotencyHeader(key) }
        : {}),
    },
  );
  if (error !== undefined || !response.ok)
    throw toApiFailure(response.status, error);
  const parsed = importAnswerSchema.safeParse(data);
  if (!parsed.success)
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
