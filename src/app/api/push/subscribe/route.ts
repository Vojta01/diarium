import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { verifyAuth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Subscribe to push notifications:
 *  - platform "web"  → web-push subscription stored in Redis (existing path)
 *  - platform "android" → FCM registration token stored in Supabase push_tokens
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication — subscription must be tied to an authenticated user
    const user = await verifyAuth(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, platform, fcm_token, token } = body;

    if (platform === "android") {
      const fcmToken = fcm_token || token;
      if (!fcmToken) {
        return Response.json({ error: "Invalid fcm_token" }, { status: 400 });
      }
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await supabase.from("push_tokens").upsert(
        { user_id: user.id, token: fcmToken, platform: "android", updated_at: new Date().toISOString() },
        { onConflict: "token" }
      );
      if (error) {
        console.error("[subscribe] FCM upsert error:", error.message);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }
      return Response.json({ ok: true, platform: "android" });
    }

    // Web push path (existing)
    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: "Redis not configured" }, { status: 500 });
    }

    await redis.sadd(SUBSCRIPTIONS_KEY, JSON.stringify(subscription));
    console.log("[subscribe] Stored web subscription, endpoint:", subscription.endpoint?.slice(0, 50));

    return Response.json({ ok: true, platform: "web" });
  } catch (err) {
    console.error("Subscribe error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const user = await verifyAuth(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, platform, fcm_token, token } = body;

    if (platform === "android") {
      const fcmToken = fcm_token || token;
      if (fcmToken) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await supabase.from("push_tokens").delete().eq("token", fcmToken);
      }
      return Response.json({ ok: true });
    }

    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: "Redis not configured" }, { status: 500 });
    }
    await redis.srem(SUBSCRIPTIONS_KEY, JSON.stringify(subscription));

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}