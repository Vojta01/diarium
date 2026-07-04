import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Default habits: only alkohol is shown to all users
// Vojta's private habits (porno, masturbace) are in user_habits table, not here
const DEFAULT_HABITS = [
  { key: "alkohol", label: "Alkohol", icon: "🍺", category: "zdraví", is_negative: true, sort_order: 1 },
];

const HABITS_TO_REMOVE = [
  "cviceni", "cist", "meditace", "zdrave_jidlo", "piti_vody",
  "porno", "masturbace",
];

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // 1. Remove habits that shouldn't be default
  if (HABITS_TO_REMOVE.length > 0) {
    await sb.from("habit_catalog").delete().in("key", HABITS_TO_REMOVE);
  }

  // 2. Upsert alkohol (only default)
  const results: { key: string; status: string }[] = [];
  for (const h of DEFAULT_HABITS) {
    const { error } = await sb.from("habit_catalog").upsert(
      {
        key: h.key,
        label: h.label,
        icon: h.icon,
        category: h.category,
        is_negative: h.is_negative,
        is_default: true,
        sort_order: h.sort_order,
      },
      { onConflict: "key" }
    );
    results.push({ key: h.key, status: error ? `❌ ${error.message}` : "✓" });
  }

  // 3. Count remaining
  const { count } = await sb.from("habit_catalog").select("*", { count: "exact", head: true });

  return NextResponse.json({
    default_habits_remaining: count,
    upserted: results,
    removed: HABITS_TO_REMOVE,
  });
}
