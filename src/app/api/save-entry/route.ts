import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { user_id, date, mood, mood_emoji, sleep_quality, stress, activities, habits, gratitude, note, weather, photo_path, phone_screen_time, phone_unlocks, phone_top_apps, ai_reflection } = payload;

    if (!user_id || !date) {
      return NextResponse.json({ error: 'Missing user_id or date' }, { status: 400 });
    }

    // Verify the caller owns this user_id
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: user_id mismatch' }, { status: 403 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Build row conditionally — only set fields that are present in the payload.
    // This allows partial updates (e.g., cron sending only screen_time without overwriting mood).
    const row: Record<string, any> = { user_id, date };
    if (mood !== undefined) row.mood = mood > 0 ? mood : null;
    if (mood_emoji !== undefined) row.mood_emoji = mood_emoji || '';
    if (stress !== undefined) row.stress = stress > 0 ? stress : null;
    if (activities !== undefined) row.activities = activities || [];
    if (habits !== undefined) row.habits = habits || {};
    if (gratitude !== undefined) row.gratitude = gratitude || [];
    if (note !== undefined) row.note = note || '';
    if (weather !== undefined) row.weather = weather || [];
    if (sleep_quality !== undefined && sleep_quality > 0) row.sleep_quality = sleep_quality;
    if (photo_path !== undefined && photo_path) row.photo_path = photo_path;
    if (phone_screen_time !== undefined) row.phone_screen_time = phone_screen_time;
    if (phone_unlocks !== undefined) row.phone_unlocks = phone_unlocks;
    if (phone_top_apps !== undefined) {
      // Normalize: accept both array and string formats
      if (Array.isArray(phone_top_apps)) {
        row.phone_top_apps = phone_top_apps;
      } else if (typeof phone_top_apps === 'string' && phone_top_apps.trim()) {
        // Old format: "App:minutes, App:minutes" → convert to [{app, time_sec}]
        row.phone_top_apps = phone_top_apps.split(',').map((item: string) => {
          const [app, min] = item.trim().split(':');
          return { app: app?.trim() || '', time_sec: parseInt(min || '0') * 60 };
        }).filter((a: any) => a.app && a.time_sec > 0);
      }
    }
    if (ai_reflection !== undefined && ai_reflection) row.ai_reflection = ai_reflection;

    const { data, error } = await supabase
      .from('entries')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) {
      console.error('save-entry error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('save-entry exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
