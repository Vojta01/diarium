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
