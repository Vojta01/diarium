import { getRedis } from "@/lib/redis";

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

export async function POST(request: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: "Redis not configured" }, { status: 500 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await redis.sadd(SUBSCRIPTIONS_KEY, JSON.stringify(subscription));
    console.log("[subscribe] Stored subscription, endpoint:", subscription.endpoint?.slice(0, 50));

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: "Redis not configured" }, { status: 500 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await redis.srem(SUBSCRIPTIONS_KEY, JSON.stringify(subscription));

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
