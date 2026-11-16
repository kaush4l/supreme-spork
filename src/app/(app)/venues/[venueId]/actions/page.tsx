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
import { listActions } from "@/server/data/corrective";
import { formatDay, formatTime } from "@/server/format";
import { ownerWords, pickState, STATE_FILTERS, stateWords } from "./words";

export const metadata = { title: "Follow-ups" };

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ state?: string; offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const state = pickState(query.state);
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const base = `/venues/${venueId}/actions`;
  const here = `${base}?state=${state}&offset=${offset}`;
  const [me, page] = await Promise.all([
    fetchMe(backend(token)),
    listActions(token, venueId, state, offset, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const when = (iso: string) => `${formatDay(iso, tz)} ${formatTime(iso, tz)}`;
  const filterLink = (s: string) => `${base}?state=${s}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Follow-ups</Heading>
      <Text type="supporting" color="secondary">
        Things to put right after a check fails, such as a reading outside its
        limits. Give each an owner and close it with a note of what was done.
      </Text>
      <HStack gap={3} wrap="wrap">
        {STATE_FILTERS.map((f) =>
          f.state === state ? (
            <Text key={f.state} type="body" aria-current="page">
              {f.label}
            </Text>
          ) : (
            <Link key={f.state} href={filterLink(f.state)}>
              {f.label}
            </Link>
          ),
        )}
      </HStack>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          {state === "open"
            ? "Nothing is waiting for a follow-up."
            : "No follow-ups here."}
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={3} hAlign="stretch">
            {page.items.map((a) => (
              <VStack key={a.id} gap={1} hAlign="stretch">
                <HStack gap={2} wrap="wrap">
                  <Link href={`${base}/${a.id}`}>{a.title}</Link>
                  {a.state === "open" && a.overdue ? (
                    <Badge label="Overdue" variant="error" />
                  ) : null}
                  {a.state !== "open" ? (
                    <Badge
                      label={stateWords(a.state)}
                      variant={a.state === "done" ? "success" : "neutral"}
                    />
                  ) : null}
                </HStack>
                {a.detail ? <Text type="body">{a.detail}</Text> : null}
                <Text type="supporting" color="secondary">
                  Owner: {ownerWords(a.owner_name)} · Due {when(a.due_at)}
                  {a.state === "open" && a.overdue ? " (Overdue)" : ""}
                </Text>
              </VStack>
            ))}
          </VStack>
        </Card>
      )}
      {offset > 0 ? (
        <Link
          href={`${filterLink(state)}&offset=${Math.max(0, offset - page.limit)}`}
        >
          Earlier ones
        </Link>
      ) : null}
      {offset + page.items.length < page.total ? (
        <Link href={`${filterLink(state)}&offset=${offset + page.limit}`}>
          More
        </Link>
      ) : null}
    </VStack>
  );
}
