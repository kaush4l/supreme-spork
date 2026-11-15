import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchRosterFileQueue } from "@/server/data/roster-files";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Roster files" };

export default async function RosterFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const status = query.status === "all" ? "all" : "check";
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/roster-files`;
  const base = `${here}?status=${status}`;
  // The backend needs roster.build for every route here, so a person without it gets "not found" from this read.
  const page = await fetchRosterFileQueue(
    principal.accessToken,
    venueId,
    status,
    offset,
    base,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Roster files</Heading>
      <UploadForm venueId={venueId} />
      <Heading level={2}>
        {status === "all" ? "All files" : "Files that need a check"}
      </Heading>
      <Link href={`${here}?status=${status === "all" ? "check" : "all"}`}>
        {status === "all" ? "Show only files to check" : "Show all files"}
      </Link>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {status === "all"
            ? "No roster files yet."
            : "No roster files need a check."}
        </Text>
      ) : null}
      {page.items.map((f) => (
        <Card key={f.document_id} padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Heading level={3}>
              <Link href={`${here}/${f.document_id}`}>
                {f.filename ?? "Roster file"}
              </Link>
            </Heading>
            <Text type="body">
              {f.label}, {f.shifts_read} shifts read
            </Text>
            <Text type="supporting" color="secondary">
              {f.help}
            </Text>
            {f.reasons.map((r) => (
              <Text key={r} type="supporting" color="secondary">
                {r}
              </Text>
            ))}
          </VStack>
        </Card>
      ))}
      {offset > 0 ? (
        <Link href={`${base}&offset=${Math.max(0, offset - page.limit)}`}>
          Earlier ones
        </Link>
      ) : null}
      {offset + page.items.length < page.total ? (
        <Link href={`${base}&offset=${offset + page.limit}`}>More</Link>
      ) : null}
    </VStack>
  );
}
