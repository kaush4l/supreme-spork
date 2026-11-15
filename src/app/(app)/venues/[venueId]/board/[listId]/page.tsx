import { Badge } from "@astryxdesign/core/Badge";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { managerListDetail } from "@/server/data/board";
import { formatDay, formatTime } from "@/server/format";
import { ItemCard } from "../../lists/[listId]/item-card";
import { progressWords, statusWord } from "../../lists/words";
import { answerForSomeone } from "./actions";

export const metadata = { title: "Checklist" };

export default async function BoardListPage({
  params,
}: {
  params: Promise<{ venueId: string; listId: string }>;
}) {
  const { venueId, listId } = await params;
  if (
    !z.uuid().safeParse(venueId).success ||
    !z.uuid().safeParse(listId).success
  )
    notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/board/${listId}`;
  const token = principal.accessToken;
  const [me, list] = await Promise.all([
    fetchMe(backend(token)),
    managerListDetail(token, venueId, listId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const when = (iso: string) => `${formatDay(iso, tz)} ${formatTime(iso, tz)}`;
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/board`}>Back to the Today board</Link>
      <Heading level={1}>{list.name}</Heading>
      <VStack gap={1} hAlign="start">
        <Badge
          label={statusWord(list.status)}
          variant={
            list.status === "done"
              ? "success"
              : list.status === "open"
                ? "neutral"
                : "warning"
          }
        />
        <Text type="supporting" color="secondary">
          Due {when(list.due_at)}
          {list.completed_at ? `, finished ${when(list.completed_at)}` : ""}
        </Text>
      </VStack>
      {list.progress.items > 0 ? (
        <ProgressBar
          label="Progress"
          value={list.progress.answered}
          max={list.progress.items}
          variant={list.status === "done" ? "success" : "accent"}
        />
      ) : null}
      <Text type="body">{progressWords(list.progress)}</Text>
      {list.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          There is nothing on this list.
        </Text>
      ) : (
        list.items.map((item) => (
          <ItemCard
            key={item.item_key}
            venueId={venueId}
            listId={listId}
            item={item}
            canEdit
            answeredLabel={
              item.answer?.answered_at
                ? `Answered ${when(item.answer.answered_at)}${item.answer.answered_by === principal.userId ? " by you" : item.answer.answered_by_name ? ` by ${item.answer.answered_by_name}` : ""}`
                : null
            }
            answer={answerForSomeone}
          />
        ))
      )}
    </VStack>
  );
}
