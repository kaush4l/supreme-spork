"use client";

import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The entry's photo from a signed link that stops working after `expiresIn` seconds. It is never stored: shortly
 * before it expires the page is asked again, which brings a fresh link.
 */
export function EntryPhoto({
  url,
  expiresIn,
}: {
  url: string | null;
  expiresIn: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!url) return;
    const wait = Math.max(30, expiresIn - 30) * 1000;
    const timer = setTimeout(() => router.refresh(), wait);
    return () => clearTimeout(timer);
  }, [url, expiresIn, router]);

  if (!url)
    return (
      <Text type="supporting" color="secondary">
        The photo is not available.
      </Text>
    );
  return (
    <VStack gap={2} hAlign="start">
      <Thumbnail src={url} alt="Photo of the waste" />
      <Link href={url} target="_blank" rel="noopener noreferrer">
        Open the full photo
      </Link>
    </VStack>
  );
}
