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
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
