import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';
import { isCronAuthorized } from '@/lib/cron-auth';
import { buildEntryRow } from '@/lib/entry-row';
import { isCheckInError } from '@/lib/checkin/errors';
import { isFutureDateKey, isValidDateKey } from '@/lib/checkin/dates';
import { PHOTO_BUCKET } from '@/lib/checkin/photo';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);

    // Server-to-server fallback (CRON_SECRET). Client traffic authenticates with the
    // user's JWT above — no client sends this secret.
    // See src/lib/cron-auth.ts for why header-based trust was removed (2026-09-10).
    const isCron = isCronAuthorized(req);

    if (!user && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { user_id, date, clear_photo, scale_values } = payload;

    if (!user_id || !date) {
      return NextResponse.json({ error: 'Missing user_id or date' }, { status: 400 });
    }

    if (!isValidDateKey(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // Prague "today", not UTC: the client clamps too, but a direct caller must
    // never be able to create a future entry.
    if (isFutureDateKey(date)) {
      return NextResponse.json({ error: 'Future date not allowed' }, { status: 400 });
    }

    // Verify the caller owns this user_id (skip for cron)
    if (user && user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: user_id mismatch' }, { status: 403 });
    }

    // The shared builder is the only place that decides field semantics:
    // undefined is omitted, weather [] is a real clear, photo_path null is
    // ignored unless clear_photo is true, and data: photo values are rejected.
    let row: Record<string, unknown>;
    try {
      row = buildEntryRow(payload);
    } catch (error) {
      if (isCheckInError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.status || 400 });
      }
      throw error;
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data, error } = await supabase
      .from('entries')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) {
      console.error('save-entry error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 400 });
    }

    // A cleared photo is removed from Storage after the row is the source of
    // truth. Best effort: a failed object delete must not roll back the clear.
    if (clear_photo === true && user) {
      const { error: removeError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([`${user.id}/${date}.jpg`]);
      if (removeError) console.error('photo delete error:', removeError);
    }

    // Mirror scale values into scale_entries so the Scales widget has per-day
    // rows. Zero means "cleared" and must delete the stale mirror row; positive
    // values are upserted. The entries.scale_values keeps the zeros on purpose
    // so a reload still knows the scale was explicitly cleared.
    if (scale_values && typeof scale_values === 'object' && user) {
      try {
        const entries = Object.entries(scale_values as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'number' && Number.isFinite(value));

        const clearedIds = entries
          .filter(([, value]) => value === 0)
          .map(([scaleId]) => scaleId);
        if (clearedIds.length > 0) {
          const { error: deleteErr } = await supabase
            .from('scale_entries')
            .delete()
            .eq('user_id', user.id)
            .eq('date', date)
            .in('scale_id', clearedIds);
          if (deleteErr) console.error('scale_entries delete error:', deleteErr);
        }

        const positivePairs = entries.filter(([, value]) => (value as number) > 0);
        if (positivePairs.length > 0) {
          const { data: userScales } = await supabase
            .from('scales')
            .select('id')
            .eq('user_id', user.id);
          const validScaleIds = new Set((userScales || []).map((s: { id: string }) => s.id));
          const scaleRows = positivePairs
            .filter(([scaleId]) => validScaleIds.has(scaleId))
            .map(([scaleId, value]) => ({
              user_id: user.id,
              scale_id: scaleId,
              date,
              value,
            }));
          if (scaleRows.length > 0) {
            const { error: scaleErr } = await supabase
              .from('scale_entries')
              .upsert(scaleRows, { onConflict: 'user_id,scale_id,date' });
            if (scaleErr) console.error('scale_entries upsert error:', scaleErr);
          }
        }
      } catch (e) {
        console.error('scale_entries mirror error:', e);
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('save-entry exception:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
