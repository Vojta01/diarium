import { NextRequest } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

let _redis: any = null;
function getRedis() {
  if (!_redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Dynamic import so build doesn't fail without env vars
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

let _vapidReady = false;
function ensureVapid() {
  if (!_vapidReady && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      "mailto:vojta1@gmail.com",
      "BOTRxmOOG-mT7D59Gs8Em2i4B9mjxPgAcnl9Hf7kyZ99-P8RMetAFvx5mxf9TM6xfG1kDgb6G26c6DJo9fTWgDM",
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
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(sub, payload).then(() => { sent++; })
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

    return Response.json({ sent });
  } catch (err) {
    console.error("Send error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
