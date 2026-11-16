import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { getAction, listOwners } from "@/server/data/corrective";
import { formatDay, formatTime } from "@/server/format";
import { wallTime } from "../../timesheet/wall";
import { closedWords, kindWords, ownerWords, stateWords } from "../words";
import { ActionControls } from "./controls";

export const metadata = { title: "Follow-up" };

export default async function ActionPage({
  params,
}: {
  params: Promise<{ venueId: string; actionId: string }>;
}) {
  const { venueId, actionId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(actionId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/actions/${actionId}`;
  const [me, item, owners] = await Promise.all([
    fetchMe(backend(token)),
    getAction(token, venueId, actionId, here),
    listOwners(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const when = (iso: string) => `${formatDay(iso, tz)} ${formatTime(iso, tz)}`;
  const open = item.state === "open";
  const base = `/venues/${venueId}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`${base}/actions`}>All follow-ups</Link>
      <Heading level={1}>{item.title}</Heading>
      <HStack gap={2} wrap="wrap">
        <Badge
          label={stateWords(item.state)}
          variant={
            item.state === "done"
              ? "success"
              : item.state === "open"
                ? "warning"
                : "neutral"
          }
        />
        {open && item.overdue ? (
          <Badge label="Overdue" variant="error" />
        ) : null}
      </HStack>
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>What failed</Heading>
          <Text type="body">{kindWords(item.kind)}.</Text>
          {item.detail ? <Text type="body">{item.detail}</Text> : null}
          <Text type="supporting" color="secondary">
            Raised {when(item.raised_at)}
          </Text>
          <HStack gap={3} wrap="wrap">
            {item.issued_list_id ? (
              <Link href={`${base}/board/${item.issued_list_id}`}>
                Open the checklist
              </Link>
            ) : null}
            {item.kind === "out_of_range" ? (
              <Link href={`${base}/readings`}>Open the readings log</Link>
            ) : null}
            {item.finding_id ? (
              <Link href={`${base}/findings/${item.finding_id}`}>
                Open the finding
              </Link>
            ) : null}
          </HStack>
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">Owner: {ownerWords(item.owner_name)}</Text>
          <Text type="body">
            Due: {when(item.due_at)}
            {open && item.overdue ? " (Overdue)" : ""}
          </Text>
        </VStack>
      </Card>
      {open ? (
        <ActionControls
          venueId={venueId}
          actionId={item.id}
          owners={owners.map((o) => ({ id: o.user_id, name: o.name }))}
          ownerUserId={item.owner_user_id ?? null}
          due={wallTime(item.due_at, tz)}
        />
      ) : (
        <Card padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={2}>
              {item.state === "cancelled" ? "Cancelled" : "Done"}
            </Heading>
            <Text type="body">
              {item.state === "cancelled" ? "Reason" : "Note"}:{" "}
              {item.note ?? "None given"}
            </Text>
            <Text type="supporting" color="secondary">
              {closedWords(item.state, item.decided_by_name)}
              {item.decided_at ? `, ${when(item.decided_at)}` : ""}
            </Text>
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
