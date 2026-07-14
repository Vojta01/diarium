import { NextRequest } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_EMAIL } from "@/lib/vapid";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

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

export async function GET(_request: NextRequest) {
  try {
    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: "Redis not configured" }, { status: 500 });
    }
    if (!ensureVapid()) {
      return Response.json({ error: "VAPID not configured" }, { status: 500 });
    }

    const rawSubs: any[] = await redis.smembers(SUBSCRIPTIONS_KEY);

    if (!rawSubs || rawSubs.length === 0) {
      return Response.json({ sent: 0, message: "No subscriptions" });
    }

    // Handle both string and object formats from Upstash
    const subscriptions = rawSubs.map((s: any) => {
      if (typeof s === "string") {
        try { return JSON.parse(s); } catch { return null; }
      }
      return s; // Already an object
    }).filter(Boolean);

    const payload = JSON.stringify({
      title: "Diarium",
      body: "Nezapomeň vyplnit dnešní záznam! 🖊️",
    });

    let sent = 0;
    let errors: string[] = [];
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(sub, payload).then(() => { sent++; }).catch((err: any) => {
          const detail = err?.body || err?.message || err?.statusCode || String(err);
          errors.push(`${err?.statusCode || '?'}: ${detail}`.slice(0, 200));
          throw err;
        })
      )
    );

    // Clean up expired subscriptions
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        const err = (r as PromiseRejectedResult).reason;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await redis.srem(SUBSCRIPTIONS_KEY, rawSubs[i]);
        }
      }
    }

    return Response.json({ sent, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error("Send error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
