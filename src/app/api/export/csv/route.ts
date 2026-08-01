import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const userId = url.searchParams.get("user_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let query = supabase
      .from("entries")
      .select("date, mood, mood_emoji, sleep_quality, stress, activities, habits, gratitude, note, scale_values")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .limit(10000);

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data: entries, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "No entries found" }, { status: 404 });
    }

    // Generate CSV
    const headers = [
      "date", "mood", "mood_emoji", "sleep_quality", "stress",
      "activities", "habits", "gratitude", "note", "scale_values"
    ];

    const csvRows = [headers.join(",")];

    for (const entry of entries) {
      const row = headers.map((col) => {
        const val = entry[col as keyof typeof entry];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        const str = String(val);
        // Escape CSV: wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="diarium-export.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
