import { AppShell } from "@astryxdesign/core/AppShell";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { navFor } from "@/server/nav";
import { VenueNav } from "./_components/venue-nav";

/**
 * The frame for every page of one venue: the navigation a person's roles and rights allow, and a venue name. Each page
 * still asks the backend for its own data, which decides what they may see.
 */
export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const [rights, me] = await Promise.all([
    myRights(principal.accessToken, venueId, `/venues/${venueId}`),
    fetchMe(backend(principal.accessToken)),
  ]);
  const venue = me.venues.find((v) => v.id === venueId);
  return (
    <AppShell
      height="auto"
      contentPadding={4}
      sideNav={
        <VenueNav
          venueId={venueId}
          venueName={venue?.name ?? "Venue"}
          sections={navFor(rights)}
        />
      }
    >
      {children}
    </AppShell>
  );
}
