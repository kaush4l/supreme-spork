import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { can } from "@/server/nav";
import { ManagerList } from "./manager-list";
import { StaffList } from "./staff-list";

export const metadata = { title: "Announcements" };

/** One address for both: people who may send see the sent list, everyone else the announcements they were told. */
export default async function AnnouncementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string; status?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const { offset: rawOffset, status: rawStatus } = await searchParams;
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .catch(0)
    .parse(rawOffset ?? 0);
  const principal = await requirePrincipal();
  const rights = await myRights(
    principal.accessToken,
    venueId,
    `/venues/${venueId}/announcements`,
  );
  if (can(rights, "announcements.send")) {
    const status = z
      .enum(["all", "active", "withdrawn", "expired"])
      .catch("all")
      .parse(rawStatus ?? "all");
    return (
      <ManagerList
        token={principal.accessToken}
        venueId={venueId}
        status={status}
        offset={offset}
      />
    );
  }
  return (
    <StaffList
      token={principal.accessToken}
      venueId={venueId}
      offset={offset}
    />
  );
}
