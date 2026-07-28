import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOOD_EMOJI: Record<number,string> = {1:"😡",2:"😟",3:"😐",4:"🙂",5:"😄"};

export async function POST(req: NextRequest) {
  const { from, to } = await req.json().catch(() => ({}));
  if (!from || !to) return Response.json({ error: "from and to required" }, { status: 400 });
  
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: entries, error } = await sb
    .from("entries").select("date,mood")
    .gte("date", from).lte("date", to);
  
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!entries?.length) return Response.json({ done: true, fixed: 0 });
  
  let fixed = 0;
  const samples: string[] = [];
  
  for (const e of entries) {
    const old = e.mood;
    if (old == null || old < 1 || old > 5) continue;
    const neo = 6 - old;
    await sb.from("entries").update({ mood: neo, mood_emoji: MOOD_EMOJI[neo] }).eq("date", e.date);
    fixed++;
    if (samples.length < 10) samples.push(`${e.date}: ${old}→${neo}`);
  }
  
  return Response.json({ from, to, fixed, samples });
}
