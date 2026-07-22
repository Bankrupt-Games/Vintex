import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "vintex.gg";
  const protocol = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const description = "Fail-closed integrity, attestation, and server validation for Android and Meta Quest Unity games by BankruptGames.";

  return {
    metadataBase: new URL(origin),
    title: "Vintex — Android Anticheat for Unity",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Vintex — Verify the device.",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Vintex Android anticheat by BankruptGames" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vintex — Verify the device.",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
