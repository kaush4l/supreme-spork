"use client";

import { Text } from "@astryxdesign/core/Text";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { REFRESH_EVERY_MS, staysFresh } from "./fresh-pages";

/**
 * Keeps a page that can change under a person's hands honest: when the tab comes back into view, and every 30 seconds
 * while it is in view, the page asks the server for its data again (what the person typed stays where it is). It shows
 * when the page was last brought up to date. Pages that are read once show nothing and ask for nothing.
 */
export function StaysFresh({
  venueId,
  timeZone,
}: {
  venueId: string;
  timeZone: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stamp, setStamp] = useState<Date>(() => new Date());
  const wasPending = useRef(false);
  const live = staysFresh(pathname, `/venues/${venueId}`);

  const refresh = useCallback(() => {
    if (document.visibilityState === "visible") start(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (wasPending.current && !pending) setStamp(new Date());
    wasPending.current = pending;
  }, [pending]);

  useEffect(() => {
    setStamp(new Date());
    if (!live) return;
    const timer = setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [live, refresh]);

  if (!live) return null;
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(stamp);
  return (
    <Text type="supporting" color="secondary">
      {pending ? "Updating…" : `Updated ${time}`}
    </Text>
  );
}
