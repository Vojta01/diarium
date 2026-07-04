import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // 1. Check habit_catalog
  const { data: catalog } = await sb.from("habit_catalog").select("*").eq("is_default", true);

  // 2. Find the user's ID
  const { data: targetUser } = await sb
    .from("profiles")
    .select("id")
    .eq("id", (await sb.auth.admin.listUsers()).data.users.find((u: any) => u.email === "you@example.com")?.id || "");

  // Find by email directly via auth admin
  const { data: users } = await sb.auth.admin.listUsers();
  const targetUser = users?.users?.find((u: any) => u.email === "you@example.com");
  
  if (!targetUser) {
    return NextResponse.json({ error: "User not found", catalog });
  }

  // 3. Get user_habits for the user
  const { data: userHabits } = await sb
    .from("user_habits")
    .select("*")
    .eq("user_id", targetUser.id);

  // 4. Fix: delete any user_habit for alkohol with is_active=false
  const { data: badEntries } = await sb
    .from("user_habits")
    .select("*")
    .eq("user_id", targetUser.id)
    .eq("key", "alkohol");

  let fixed: string[] = [];
  if (badEntries && badEntries.length > 0) {
    await sb
      .from("user_habits")
      .delete()
      .eq("user_id", targetUser.id)
      .eq("key", "alkohol");
    fixed.push("Removed alkohol override from user_habits");
  }

  // 5. Ensure kouření + studená sprcha exist for the user
  const defaultHabits = [
    { key: "koureni", label: "Kouření", icon: "🚬", is_negative: true },
    { key: "studena_sprcha", label: "Studená sprcha", icon: "🫣", is_negative: true },
  ];

  for (const h of defaultHabits) {
    const existing = userHabits?.find((uh: any) => uh.key === h.key);
    if (!existing) {
      await sb.from("user_habits").upsert({
        user_id: targetUser.id,
        key: h.key,
        label: h.label,
        icon: h.icon,
        is_negative: h.is_negative,
        is_active: true,
      }, { onConflict: "user_id,key" });
      fixed.push(`Added ${h.key} for the user`);
    }
  }

  // 6. Return debug info
  const { data: finalUserHabits } = await sb
    .from("user_habits")
    .select("*")
    .eq("user_id", targetUser.id);

  return NextResponse.json({
    user_id: targetUser.id,
    catalog_defaults: catalog?.map((c: any) => c.key),
    user_habits_before: userHabits?.map((h: any) => ({ key: h.key, is_active: h.is_active })),
    user_habits_after: finalUserHabits?.map((h: any) => ({ key: h.key, is_active: h.is_active })),
    fixed,
  });
}
