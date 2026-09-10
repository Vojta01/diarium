import { NextRequest } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_EMAIL } from "@/lib/vapid";
import { getRedis } from "@/lib/redis";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _vapidReady = false;
function ensureVapid() {
  if (!_vapidReady && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      VAPID_EMAIL,
      VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    _vapidReady = true;
  }
  return _vapidReady;
}

export async function GET(request: NextRequest) {
  try {
    // Server-only — requires the CRON_SECRET (Bearer or ?secret=). See
    // src/lib/cron-auth.ts: the caller-supplied `x-vercel-cron` header used to
    // be trusted here, which let anyone trigger a push to all subscribers.
    const url = new URL(request.url);
    if (!isCronAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = JSON.parse(url.searchParams.get("message") || "{}");
    const title = message.title || "Diarium";
    const body = message.body || "Nezapomeň vyplnit dnešní záznam! 🖊️";

    let webSent = 0;
    let webErrors = 0;

    // ── Web push (PWA/browser) via Redis subscriptions ──
    // Variant A: Android notifications are scheduled LOCALLY in the app at
    // user-chosen times; the server only keeps web push for PWA/browser users.
    // (FCM is intentionally not used here anymore to avoid duplicates.)
    const redis = getRedis();
    if (redis && ensureVapid()) {
      const rawSubs: any[] = await redis.smembers(SUBSCRIPTIONS_KEY);
      const subscriptions = rawSubs.map((s: any) => {
        if (typeof s === "string") {
          try { return JSON.parse(s); } catch { return null; }
        }
        return s;
      }).filter(Boolean);

      const payload = JSON.stringify({ title, body });
      const results = await Promise.allSettled(
        subscriptions.map((sub: any) =>
          webpush.sendNotification(sub, payload).then(() => { webSent++; }).catch((err: any) => {
            webErrors++;
            throw err;
          })
        )
      );
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "rejected") {
          const err = (r as PromiseRejectedResult).reason;
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await redis.srem(SUBSCRIPTIONS_KEY, rawSubs[i]);
          }
        }
      }
    }

    return Response.json({
      webSent,
      webErrors: webErrors > 0 ? webErrors : undefined,
    });
  } catch (err) {
    console.error("Send error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}