import { NextRequest } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_EMAIL } from "@/lib/vapid";
import { getRedis } from "@/lib/redis";
import { createClient } from "@supabase/supabase-js";
import { sendFcm } from "@/lib/fcm";

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
    // Server-only — require CRON_SECRET bearer token or ?secret= query param
    const url = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const querySecret = url.searchParams.get("secret");
    const isAuthorized = !cronSecret
      || authHeader === `Bearer ${cronSecret}`
      || querySecret === cronSecret
      || request.headers.get("x-vercel-cron") === "1";
    if (!isAuthorized) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = JSON.parse(url.searchParams.get("message") || "{}");
    const title = message.title || "Diarium";
    const body = message.body || "Nezapomeň vyplnit dnešní záznam! 🖊️";

    let webSent = 0;
    let fcmSent = 0;
    let webErrors = 0;
    let fcmErrors: string[] = [];
    let deadFcmTokens: string[] = [];

    // ── 1. Web push (PWA/browser) via Redis subscriptions ──
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

    // ── 2. Native FCM (Diarium Android) via Supabase push_tokens ──
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: fcmTokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token");
    if (!tokensError && fcmTokens) {
      for (const row of fcmTokens) {
        const res = await sendFcm(row.token, { title, body });
        if (res.ok) {
          fcmSent++;
        } else {
          fcmErrors.push(`${res.status || "?"}:${(res.error || "").slice(0, 80)}`);
          const errMsg = res.error || "";
          if (
            res.status === 404 || res.status === 410 ||
            errMsg.includes("UNREGISTERED") ||
            errMsg.includes("registration token") || errMsg.includes("INVALID_ARGUMENT")
          ) {
            deadFcmTokens.push(row.token);
          }
        }
      }
      // Purge dead tokens so we don't keep hammering FCM
      if (deadFcmTokens.length > 0) {
        await supabase.from("push_tokens").delete().in("token", deadFcmTokens);
      }
    }

    return Response.json({
      webSent,
      fcmSent,
      webErrors: webErrors > 0 ? webErrors : undefined,
      fcmErrors: fcmErrors.length > 0 ? fcmErrors.slice(0, 5) : undefined,
      deadFcmPurged: deadFcmTokens.length,
    });
  } catch (err) {
    console.error("Send error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}