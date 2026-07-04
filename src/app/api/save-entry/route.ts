import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcWJzbGdoemdmb3R3aHpnYXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI2ODU4NCwiZXhwIjoyMDk2ODQ0NTg0fQ.WPFndGpamQKsWAvwEv1T9AsllDCaRD9FQGbJUEZL5xg';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { user_id, date, mood, mood_emoji, sleep_quality, stress, activities, habits, gratitude, note, weather } = payload;

    if (!user_id || !date) {
      return NextResponse.json({ error: 'Missing user_id or date' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const row: Record<string, any> = {
      user_id,
      date,
      mood: mood || 0,
      mood_emoji: mood_emoji || '',
      stress: stress || 0,
      activities: activities || [],
      habits: habits || {},
      gratitude: gratitude || [],
      note: note || '',
      weather: weather || [],
    };
    if (sleep_quality > 0) row.sleep_quality = sleep_quality;

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
