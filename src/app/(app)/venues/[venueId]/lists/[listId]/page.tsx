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
import { myListDetail } from "@/server/data/lists";
import { formatDay, formatTime } from "@/server/format";
import { progressWords, statusWord } from "../words";
import { answerItem, markNotApplicable } from "./actions";
import { AddItem } from "./add-item";
import { FinishBar } from "./finish-bar";
import { ItemCard } from "./item-card";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage({
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
  const here = `/venues/${venueId}/lists/${listId}`;
  const token = principal.accessToken;
  const [me, list] = await Promise.all([
    fetchMe(backend(token)),
    myListDetail(token, venueId, listId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const done = list.status === "done";
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/lists`}>All my checklists</Link>
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
          {done && list.completed_at
            ? `Finished ${formatDay(list.completed_at, tz)} ${formatTime(list.completed_at, tz)}`
            : `Due ${formatDay(list.due_at, tz)} ${formatTime(list.due_at, tz)}`}
        </Text>
      </VStack>
      {list.progress.items > 0 ? (
        <ProgressBar
          label="Progress"
          value={list.progress.answered}
          max={list.progress.items}
          variant={done ? "success" : "accent"}
        />
      ) : null}
      <Text type="body">{progressWords(list.progress)}</Text>
      {done ? (
        <Text type="supporting" color="secondary">
          This list is finished. Ask a manager if something needs to change.
        </Text>
      ) : null}
      {list.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          There is nothing on this list yet.
        </Text>
      ) : (
        list.items.map((item) => (
          <ItemCard
            key={item.item_key}
            venueId={venueId}
            listId={listId}
            item={item}
            canEdit={!done}
            answeredLabel={
              item.answer?.answered_at
                ? `Saved ${formatTime(item.answer.answered_at, tz)}`
                : null
            }
            answer={answerItem}
            notApplicable={markNotApplicable}
          />
        ))
      )}
      {done ? null : (
        <>
          <AddItem venueId={venueId} listId={listId} />
          <FinishBar venueId={venueId} listId={listId} />
        </>
      )}
    </VStack>
  );
}
