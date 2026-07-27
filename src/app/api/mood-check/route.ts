import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOOD_LABELS: Record<number,string> = {1:"😡 hrozně",2:"😟 špatně",3:"😐 neutrálně",4:"🙂 dobře",5:"😄 skvěle"};

export async function GET(_request: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Get entries for specific days the user can verify with Daylio
  const { data } = await sb.from("entries").select("date,mood,mood_emoji,note").in("date", [
    "2026-07-25","2026-07-20","2026-07-15","2026-07-10","2026-07-01",
    "2026-06-25","2026-06-15","2026-02-06" // last Daylio import entry
  ]).order("date", { ascending: false });

  const result = (data||[]).map((e:any) => ({
    date: e.date,
    mood: e.mood,
    label: MOOD_LABELS[e.mood] || "?",
    stored_emoji: e.mood_emoji,
    note: (e.note||"").substring(0,80)
  }));

  return Response.json({ count: result.length, entries: result });
}
