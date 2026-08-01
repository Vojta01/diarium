import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function escapePDF(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, "\\n");
}

function generatePDF(entries: any[]): string {
  const lines: string[] = [];

  // PDF header
  lines.push("%PDF-1.4");
  const objects: string[] = [];

  // Page content
  let pageContent = "BT\n";
  pageContent += "/F1 12 Tf\n"; // Font size
  pageContent += "50 750 Td\n"; // Start position
  pageContent += "(Diarium Export) Tj\n";
  pageContent += "0 -20 Td\n";
  pageContent += `/F1 8 Tf\n`;
  pageContent += `(Generated: ${new Date().toISOString().split("T")[0]}) Tj\n`;
  pageContent += "0 -20 Td\n\n";

  for (const entry of entries) {
    const date = entry.date || "N/A";
    const mood = entry.mood ? `${entry.mood_emoji || ""} ${entry.mood}/5` : "N/A";
    const activities = entry.activities?.length ? (entry.activities as string[]).join(", ") : "none";
    const note = entry.note || "";
    const sleep = entry.sleep_quality ? `Sleep: ${entry.sleep_quality}/3` : "";
    const stress = entry.stress ? `Stress: ${entry.stress}/5` : "";

    const line = escapePDF(`${date} | ${mood} | ${sleep} ${stress} | ${activities}`);
    pageContent += `/F1 8 Tf\n`;
    pageContent += `(${line}) Tj\n`;
    pageContent += "0 -14 Td\n";

    if (note) {
      const shortNote = note.length > 100 ? note.substring(0, 97) + "..." : note;
      pageContent += `/F1 7 Tf\n`;
      pageContent += `(${escapePDF("  " + shortNote)}) Tj\n`;
      pageContent += "0 -12 Td\n";
    }

    // Page overflow check (simple: ~30 entries per page)
    if (entries.indexOf(entry) > 0 && entries.indexOf(entry) % 30 === 0) {
      pageContent += "ET\n";
      objects.push(pageContent);
      pageContent = "BT\n/F1 8 Tf\n50 750 Td\n";
    }
  }

  pageContent += "ET\n";
  objects.push(pageContent);

  // Build PDF objects
  const pages: string[] = [];
  for (let i = 0; i < objects.length; i++) {
    const contentObj = 3 + i * 2;
    const pageObj = contentObj - 1;

    // Page object
    objects.push(`${pageObj} 0 obj
<< /Type /Page
   /Parent 1 0 R
   /MediaBox [0 0 612 792]
   /Contents ${contentObj} 0 R
   /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
>>
endobj`);

    // Content object
    objects.push(`${contentObj} 0 obj
<< /Length ${objects[i].length} >>
stream
${objects[i]}
endstream
endobj`);

    pages.push(`${pageObj} 0 R`);
  }

  // Build the PDF
  const catalog = `1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj`;

  const pagesObj = `2 0 obj
<< /Type /Pages /Kids [${pages.join(" ")}] /Count ${pages.length} >>
endobj`;

  const fullPDF = [
    "%PDF-1.4",
    catalog,
    pagesObj,
    ...objects.slice(objects.length), // all non-content objects
    "", // trailer needs xref
  ];

  return fullPDF.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let query = supabase
      .from("entries")
      .select("date, mood, mood_emoji, sleep_quality, stress, activities, note")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data: entries, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "No entries found" }, { status: 404 });
    }

    const pdf = generatePDF(entries);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="diarium-export.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
