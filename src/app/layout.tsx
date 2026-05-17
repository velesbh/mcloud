import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-minecraft",
  subsets: ["latin"],
  weight: "400",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mcloud.enzonic.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "MCloud — Minecraft Hosting",
    template: "%s | MCloud",
  },
  description:
    "Host Minecraft servers effortlessly. Spawn in seconds, install mods in a click, manage everything from your browser. Free tier — no credit card.",
  keywords: [
    "Minecraft hosting",
    "Minecraft server",
    "free Minecraft server",
    "Java server hosting",
    "Bedrock server hosting",
    "Modrinth mods",
    "MCloud",
    "Enzonic",
  ],
  authors: [{ name: "Enzonic LLC", url: APP_URL }],
  creator: "Enzonic LLC",
  publisher: "Enzonic LLC",

  // ── Icons ────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.svg",    type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },

  // ── Open Graph ───────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "MCloud",
    title: "MCloud — Minecraft Hosting",
    description:
      "Host Minecraft servers effortlessly. Spawn in seconds, install mods in a click, manage everything from your browser. Free tier — no credit card.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MCloud — Minecraft hosting that just works",
      },
    ],
    locale: "en_US",
  },

  // ── Twitter / X ──────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "MCloud — Minecraft Hosting",
    description:
      "Host Minecraft servers effortlessly. Free tier, no credit card.",
    images: ["/og-image.png"],
    site: "@enzonic",
  },

  // ── Robots ───────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Misc ─────────────────────────────────────────────────────────────
  category: "technology",
  applicationName: "MCloud",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} h-full`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
