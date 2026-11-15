import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { myEmployments } from "@/server/data/person";
import { dayLabel } from "@/server/data/person-text";

export const metadata = { title: "Where I work" };

export default async function WorkPage() {
  const principal = await requirePrincipal();
  const jobs = await myEmployments(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Where I work</Heading>
        <Text type="body" color="secondary">
          Every venue you work or have worked at.
        </Text>
      </VStack>
      {jobs.length === 0 ? (
        <Text type="body">
          You do not work at any venue yet. When a venue adds you and you
          accept, it shows here.
        </Text>
      ) : (
        <VStack gap={2} hAlign="stretch">
          {jobs.map((job) => (
            <Card key={job.staff_id} padding={4}>
              <VStack gap={1}>
                {job.active ? (
                  <Link href={`/venues/${job.venue_id}`}>
                    {job.venue_name ?? "A venue"}
                  </Link>
                ) : (
                  <Text type="body">{job.venue_name ?? "A venue"}</Text>
                )}
                <Text type="supporting" color="secondary">
                  {job.active ? "Working here now" : "No longer working here"}
                </Text>
                <Text type="supporting" color="secondary">
                  {job.position_names.length > 0
                    ? job.position_names.join(", ")
                    : "No position set"}
                </Text>
                {job.started_on || job.ended_on ? (
                  <Text type="supporting" color="secondary">
                    {job.started_on ? `From ${dayLabel(job.started_on)}` : ""}
                    {job.started_on && job.ended_on ? " " : ""}
                    {job.ended_on ? `to ${dayLabel(job.ended_on)}` : ""}
                  </Text>
                ) : null}
              </VStack>
            </Card>
          ))}
        </VStack>
      )}
      <Link href="/">Back</Link>
    </VStack>
  );
}
