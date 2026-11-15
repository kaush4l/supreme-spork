import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";
import { isDay } from "../../timesheet/range";
import { isDataset } from "../datasets";

const params = z.object({ venueId: z.uuid() });

/** Streams one of the backend's export CSVs with the signed-in person's session; the token never reaches the browser. */
export const GET = handler(async (request, principal) => {
  const match = /\/venues\/([^/]+)\/downloads\/([^/?]+)/.exec(
    new URL(request.url).pathname,
  );
  const parsed = params.safeParse({ venueId: match?.[1] });
  const dataset = match?.[2];
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!parsed.success || !isDataset(dataset))
    throw new ApiFailure(404, "not_found", "We cannot find that download.");
  if (!isDay(from) || !isDay(to))
    throw new ApiFailure(422, "bad_range", "Choose valid dates.");
  const { data, error, response } = await backend(principal.accessToken).GET(
    "/v1/venues/{venue_id}/exports/{dataset}",
    {
      params: {
        path: { venue_id: parsed.data.venueId, dataset },
        query: { from, to },
      },
      parseAs: "stream",
    },
  );
  if (!response.ok || !data) throw toApiFailure(response.status, error);
  return new Response(data as ReadableStream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataset}-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
