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

              // ── Service Worker registration ──
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function() {
                  // Registration failed — SW unavailable, app still works without it
                });

                // ── Watch for stuck SW: if controllerchange never fires, do nothing harmful ──
                // The SW will eventually update on next page load.

                // ── Conservative fetch-error detector ──
                // If the page fails to load critical assets (5+ errors), redirect to /sw-reset.html.
                var _errorCount = 0;
                window.addEventListener('error', function(e) {
                  // Only count resource load failures (not JS runtime errors)
                  if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG')) {
                    _errorCount++;
                    if (_errorCount >= 5) {
                      location.replace('/sw-reset.html');
                    }
                  }
                }, true);
              }
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
