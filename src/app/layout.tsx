import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Supreme Spork",
  description: "Next.js + Bun + Biome + TypeScript + Astryx",
  // The picture iOS uses when someone adds the site to the Home Screen.
  icons: { apple: "/icon-192.png" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every page is rendered per request, so the nonce in the Content-Security-Policy reaches its scripts.
  await connection();
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
