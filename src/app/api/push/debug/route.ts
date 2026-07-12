import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

let _redis: any = null;
function getRedis() {
  if (!_redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return Response.json({ error: "Redis not configured" }, { status: 500 });

  const rawSubs: any[] = await redis.smembers(SUBSCRIPTIONS_KEY);
  const subs = (rawSubs || []).map((s: any) => {
    if (typeof s === "string") {
      try {
        const parsed = JSON.parse(s);
        return parsed; // Return full subscription for debugging
      } catch {
        return { raw: s };
      }
    }
    return s;
  });

  return Response.json({ count: subs.length, subscriptions: subs });
}
