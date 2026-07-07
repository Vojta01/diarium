import type { Metadata, Viewport } from "next";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diarium",
  description: "Denní check-in do tvého Obsidian vaultu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Diarium",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
              }
            `,
          }}
        />
      </head>
      <body>{children}<PushNotificationManager /><UpdatePrompt /></body>
    </html>
  );
}
