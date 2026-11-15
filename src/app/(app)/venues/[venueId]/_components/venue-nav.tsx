"use client";

import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/server/nav";

/** The side navigation for one venue (a drawer on a phone). It only marks the current page; what is shown was decided on the server. */
export function VenueNav({
  venueId,
  venueName,
  sections,
}: {
  venueId: string;
  venueName: string;
  sections: NavSection[];
}) {
  const pathname = usePathname();
  const base = `/venues/${venueId}`;
  return (
    <SideNav
      header={
        <SideNavHeading
          heading={venueName}
          superheading="Minder"
          superheadingHref="/"
        />
      }
    >
      {sections.map((section) => (
        <SideNavSection key={section.title} title={section.title}>
          {section.items.map((item) => (
            <SideNavItem
              key={item.key}
              label={item.label}
              href={`${base}${item.path}`}
              isSelected={pathname.startsWith(`${base}${item.path}`)}
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
