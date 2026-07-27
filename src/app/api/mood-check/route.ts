import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELS: Record<number,string> = {1:"😡 hrozně",2:"😟 špatně",3:"😐 neutrálně",4:"🙂 dobře",5:"😄 skvěle"};

export async function GET(_request: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("entries").select("date,mood,mood_emoji,note")
    .in("date", ["2026-07-12","2026-02-06","2026-07-10","2026-07-25"])
    .order("date", { ascending: false });
  return Response.json((data||[]).map((e:any)=>({
    date:e.date, mood:e.mood, label:LABELS[e.mood]||"?", note:(e.note||"").substring(0,60)
  })));
}
