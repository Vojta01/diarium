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
              // ── Emergency kill-switch: ?sw-reset redirects before SW init ──
              if (location.search.includes('sw-reset')) {
                location.replace('/sw-reset');
              }

              // ── Service Worker registration with self-healing ──
              if ('serviceWorker' in navigator) {
                var _swInitFailed = false;
                var _swRegTimeout = setTimeout(function() {
                  _swInitFailed = true;
                }, 15000);

                navigator.serviceWorker.register('/sw.js')
                  .then(function() {
                    clearTimeout(_swRegTimeout);
                  })
                  .catch(function() {
                    clearTimeout(_swRegTimeout);
                    _swInitFailed = true;
                  });

                // ── Watch for stuck SW: if controllerchange never fires, do nothing harmful ──
                // The SW will eventually update on next page load.

                // ── Conservative fetch-error detector ──
                // If the page fails to load critical assets (3+ errors), redirect to /sw-reset.
                var _errorCount = 0;
                window.addEventListener('error', function(e) {
                  // Only count resource load failures (not JS runtime errors)
                  if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG')) {
                    _errorCount++;
                    if (_errorCount >= 5) {
                      location.replace('/sw-reset');
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
