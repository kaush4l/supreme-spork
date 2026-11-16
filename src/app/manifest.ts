import type { MetadataRoute } from "next";

/** So an iPhone can add Minder to the Home Screen (iOS delivers web push only to an installed app). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Minder",
    short_name: "Minder",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
