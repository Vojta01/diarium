import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Backfill: copy historical scale values from entries.scale_values (JSONB)
 * into the scale_entries table, which the Scales widget reads.
 *
 * The Daylio expansion initially stored scale values ONLY inside entries.scale_values,
 * while ScalesWidget reads scale_entries — so the widget always rendered empty.
 * This endpoint migrates the existing data. New saves mirror automatically
 * via /api/save-entry.
 *
 * GET /api/backfill-scale-entries?user_id=<uuid>
 *   user_id: optional — when omitted, backfills ALL users' entries.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = req.nextUrl.searchParams.get('user_id') || user.id;
    // Only allow admin (self) or service-level calls; keep it simple: self or explicit user_id with auth match
    if (targetUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: can only backfill your own data' }, { status: 403 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch valid scales for this user (id → min/max for range validation)
    const { data: scales } = await supabase
      .from('scales')
      .select('id, min_value, max_value')
      .eq('user_id', targetUserId)
      .eq('is_active', true);
    const scaleDefs = new Map((scales || []).map((s: any) => [s.id, s]));

    // Fetch entries that have scale_values, newest last (they are ordered ascending by date)
    const { data: entries, error: entriesErr } = await supabase
      .from('entries')
      .select('date, scale_values')
      .eq('user_id', targetUserId)
      .not('scale_values', 'is', null)
      .order('date', { ascending: true })
      .limit(10000);

    if (entriesErr) {
      return NextResponse.json({ error: entriesErr.message }, { status: 400 });
    }

    const rows: { user_id: string; scale_id: string; date: string; value: number }[] = [];
    let skippedUnknown = 0;

    for (const entry of entries || []) {
      const sv = (entry as any).scale_values;
      if (!sv || typeof sv !== 'object') continue;
      for (const [scaleId, rawValue] of Object.entries(sv)) {
        const def = scaleDefs.get(scaleId);
        if (!def) {
          skippedUnknown++;
          continue;
        }
        const value = Number(rawValue);
        if (!Number.isFinite(value) || value <= 0) continue; // 0 = not selected
        rows.push({ user_id: targetUserId, scale_id: scaleId, date: (entry as any).date, value });
      }
    }

    let upserted = 0;
    let upsertErrMsg: string | null = null;
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('scale_entries')
        .upsert(rows, { onConflict: 'user_id,scale_id,date' });
      if (upsertErr) upsertErrMsg = upsertErr.message;
      else upserted = rows.length;
    }

    return NextResponse.json({
      userId: targetUserId,
      entriesProcessed: (entries || []).length,
      rowsUpserted: upserted,
      skippedUnknownScale: skippedUnknown,
      upsertError: upsertErrMsg,
    });
  } catch (e: any) {
    console.error('backfill-scale-entries exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
