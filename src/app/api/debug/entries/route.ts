import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: any = {};

  const { data: entries, error: entriesErr } = await supabase
    .from("entries")
    .select("user_id,date,note,mood")
    .order("date", { ascending: false })
    .limit(500);

  if (entriesErr) {
    results.entries_error = entriesErr.message;
  } else {
    results.total_entries = entries.length;
    results.last_10 = (entries || []).slice(0, 10).map((e: any) => ({
      date: e.date,
      user_id: (e.user_id || "").substring(0, 12) + "...",
      mood: e.mood,
      note: (e.note || "").substring(0, 60),
    }));
    results.unique_user_ids = Array.from(new Set((entries || []).map((e: any) => e.user_id)));
    results.date_range = {
      first: entries?.[entries.length - 1]?.date,
      last: entries?.[0]?.date,
    };
    const perMonth: Record<string, number> = {};
    for (const e of entries || []) {
      const month = (e as any).date?.substring(0, 7);
      if (month) perMonth[month] = (perMonth[month] || 0) + 1;
    }
    results.per_month = perMonth;
  }

  try {
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    if (!usersErr && users) {
      results.auth_users = users.users.map((u: any) => ({
        id: u.id.substring(0, 12) + "...",
        email: u.email,
        created_at: u.created_at,
      }));
    } else {
      results.auth_users_error = usersErr?.message || "no data";
    }
  } catch (e: any) {
    results.auth_users_error = e.message;
  }

  return Response.json(results);
}
