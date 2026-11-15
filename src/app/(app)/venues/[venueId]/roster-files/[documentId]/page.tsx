import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchRosterFile } from "@/server/data/roster-files";
import { formatDay, formatSpan } from "@/server/format";
import { ReviewButtons } from "./review-buttons";

export const metadata = { title: "Roster file" };

export default async function RosterFilePage({
  params,
}: {
  params: Promise<{ venueId: string; documentId: string }>;
}) {
  const { venueId, documentId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(documentId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/roster-files/${documentId}`;
  const [f, me] = await Promise.all([
    fetchRosterFile(principal.accessToken, venueId, documentId, here),
    fetchMe(backend(principal.accessToken)),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/roster-files`}>Back to roster files</Link>
      <Heading level={1}>{f.filename ?? "Roster file"}</Heading>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">{f.label}</Text>
          <Text type="supporting" color="secondary">
            {f.help}
          </Text>
          <Text type="supporting" color="secondary">
            {f.shifts_total} shifts read.
          </Text>
          {f.file_url ? (
            <Link href={f.file_url}>
              Open the file (link works for a few minutes)
            </Link>
          ) : null}
        </VStack>
      </Card>
      {f.reasons.length > 0 ? (
        <VStack gap={1} hAlign="stretch">
          <Heading level={2}>Why it was held back</Heading>
          {f.reasons.map((r) => (
            <Text key={r} type="body">
              {r}
            </Text>
          ))}
        </VStack>
      ) : null}
      {f.people_not_in_staff_list.length > 0 ? (
        <VStack gap={1} hAlign="stretch">
          <Heading level={2}>People missing from the staff list</Heading>
          <Text type="supporting" color="secondary">
            Add them on the Team screen so their shifts can be matched.
          </Text>
          {f.people_not_in_staff_list.map((p) => (
            <Text key={p.staff_ref} type="body">
              {p.name ?? p.staff_ref} ({p.staff_ref})
            </Text>
          ))}
        </VStack>
      ) : null}
      <ReviewButtons
        venueId={venueId}
        documentId={documentId}
        waiting={f.status === "needs_check"}
      />
      <Heading level={2}>
        Shifts read
        {f.shifts_shown < f.shifts_total ? ` (first ${f.shifts_shown})` : ""}
      </Heading>
      {f.shifts.length === 0 ? (
        <Text type="supporting" color="secondary">
          No shifts were read from this file.
        </Text>
      ) : null}
      {f.shifts.map((s) => (
        <Text key={s.line} type="supporting" color="secondary">
          Line {s.line}: {s.staff_name ?? s.staff_ref ?? "No name"}, {s.role},{" "}
          {s.start && s.end
            ? `${formatDay(s.start, tz)} ${formatSpan(s.start, s.end, tz)}`
            : "no times"}
          {s.status ? `, ${s.status}` : ""}
        </Text>
      ))}
    </VStack>
  );
}
