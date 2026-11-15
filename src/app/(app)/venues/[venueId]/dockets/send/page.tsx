import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { canDecide, canSend } from "../words";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Send a docket" };

export default async function SendDocketPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const rights = await myRights(
    principal.accessToken,
    venueId,
    `/venues/${venueId}/dockets/send`,
  );
  if (!canSend(rights)) notFound();
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Send a docket</Heading>
      <Text type="supporting" color="secondary">
        Take a clear photo of the delivery docket, or choose a photo or PDF you
        already have. Sending the same one twice is safe.
      </Text>
      <UploadForm venueId={venueId} canOpen={canDecide(rights)} />
      {canDecide(rights) ? (
        <Link href={`/venues/${venueId}/dockets`}>Back to dockets</Link>
      ) : null}
    </VStack>
  );
}
