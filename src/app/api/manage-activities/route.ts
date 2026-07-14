import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const { action, userId, key, label, icon, category } = await req.json();

  if (!userId || !action) {
    return NextResponse.json({ error: "Missing userId or action" }, { status: 400 });
  }

  // Verify the caller owns this userId
  if (userId !== user.id) {
    return NextResponse.json({ error: "Forbidden: user_id mismatch" }, { status: 403 });
  }

  if (action === "add") {
    if (!key || !label) {
      return NextResponse.json({ error: "Missing key or label" }, { status: 400 });
    }

    const { error } = await sb.from("user_activities").upsert(
      {
        user_id: userId,
        key,
        label,
        icon: icon || "📌",
        category: category || "vlastní",
        is_active: true,
      },
      { onConflict: "user_id,key" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "add", key });
  }

  if (action === "remove") {
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Mark as inactive (soft delete) — or hard delete if it's a custom activity
    const { error } = await sb.from("user_activities").upsert(
      {
        user_id: userId,
        key,
        label: key,
        icon: "📌",
        is_active: false,
      },
      { onConflict: "user_id,key" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "remove", key });
  }

  if (action === "restore") {
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Delete the is_active=false entry — activity becomes visible again
    const { error } = await sb
      .from("user_activities")
      .delete()
      .eq("user_id", userId)
      .eq("key", key)
      .eq("is_active", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "restore", key });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
