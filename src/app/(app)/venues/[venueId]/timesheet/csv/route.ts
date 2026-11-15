import { z } from "zod";
import { backend } from "@/server/api/backend";
import { ApiFailure, toApiFailure } from "@/server/api/errors";
import { handler } from "@/server/handler";
import { isDay } from "../range";

const params = z.object({ venueId: z.uuid() });

/** Streams the backend's timesheet CSV with the signed-in person's session; the token never reaches the browser. */
export const GET = handler(async (request, principal) => {
  const match = /\/venues\/([^/]+)\/timesheet\/csv/.exec(
    new URL(request.url).pathname,
  );
  const parsed = params.safeParse({ venueId: match?.[1] });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!parsed.success || !isDay(from) || !isDay(to))
    throw new ApiFailure(422, "bad_range", "Choose valid dates.");
  const { data, error, response } = await backend(principal.accessToken).GET(
    "/v1/venues/{venue_id}/timesheet",
    {
      params: {
        path: { venue_id: parsed.data.venueId },
        query: { from, to, format: "csv" },
      },
      parseAs: "stream",
    },
  );
  if (!response.ok || !data) throw toApiFailure(response.status, error);
  return new Response(data as ReadableStream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
