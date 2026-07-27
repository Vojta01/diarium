import type { Metadata, Viewport } from "next";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { I18nProvider } from "@/lib/i18n";
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
              // ── Emergency kill-switch: ?sw-reset redirects to static reset page ──
              if (location.search.includes('sw-reset')) {
                location.replace('/sw-reset.html');
              }

              // ── Service Worker temporarily DISABLED for debugging ──
              // if ('serviceWorker' in navigator) {
              //   navigator.serviceWorker.register('/sw.js').catch(function() {});
              // }
            `,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          {children}
          <PushNotificationManager />
          <UpdatePrompt />
        </I18nProvider>
      </body>
    </html>
  );
}
