import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOOD_EMOJI: Record<number,string> = {1:"😡",2:"😟",3:"😐",4:"🙂",5:"😄"};

export async function POST(_request: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // 1. Get ALL entries before July 1, 2026
  const { data: entries, error } = await sb
    .from("entries")
    .select("date,mood,mood_emoji")
    .lt("date", "2026-07-01");
  
  if (error) return Response.json({ error: error.message }, { status: 500 });
  
  let fixed = 0;
  let skipped = 0;
  const log: string[] = [];
  
  for (const e of (entries || [])) {
    const oldMood = e.mood;
    if (oldMood == null || oldMood < 1 || oldMood > 5) { skipped++; continue; }
    
    const newMood = 6 - oldMood;
    const newEmoji = MOOD_EMOJI[newMood] || "";
    
    const { error: updErr } = await sb
      .from("entries")
      .update({ mood: newMood, mood_emoji: newEmoji })
      .eq("date", e.date);
    
    if (updErr) {
      log.push(`${e.date}: FAILED — ${updErr.message}`);
    } else {
      fixed++;
      if (fixed <= 10) log.push(`${e.date}: ${oldMood}→${newMood} (${e.mood_emoji}→${newEmoji})`);
    }
  }
  
  return Response.json({ fixed, skipped, total: (entries||[]).length, samples: log });
}
