import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Supreme Spork",
  description: "Next.js + Bun + Biome + TypeScript + Astryx",
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
