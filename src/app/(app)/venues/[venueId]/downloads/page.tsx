import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { can } from "@/server/nav";
import { lastFinishedWeek } from "../pnl/range";
import { todayIn } from "../timesheet/range";
import { DATASETS } from "./datasets";
import { DownloadForm } from "./download-form";

export const metadata = { title: "Downloads" };

export default async function DownloadsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const me = await fetchMe(backend(token));
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const rights = await myRights(token, venueId, `/venues/${venueId}/downloads`);
  if (!can(rights, "money.exports")) notFound();
  const { from, to } = lastFinishedWeek(todayIn(new Date(), tz));
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Downloads</Heading>
      <Text type="supporting" color="secondary">
        Spreadsheets (CSV) for your accountant, up to 366 days at a time. Every
        row says how it was counted and what is missing.
      </Text>
      <DownloadForm venueId={venueId} datasets={DATASETS} from={from} to={to} />
    </VStack>
  );
}
