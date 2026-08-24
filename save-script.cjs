const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('/root/diarium/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=\"([^\"]+)\"$/);
  if (m) env[m[1]] = m[2];
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const row = {
  user_id: '4a4de4ba-4733-4699-b2a8-2ad0db8ec700',
  date: '2026-08-24',
  phone_screen_time: 25393,
  phone_unlocks: 43,
  phone_top_apps: [
    { app: 'Launcher', time_sec: 7557 },
    { app: 'music', time_sec: 4414 },
    { app: 'ggpool', time_sec: 2172 },
    { app: 'gms', time_sec: 1810 },
    { app: 'WhatsApp', time_sec: 1786 }
  ]
};

supabase
  .from('entries')
  .upsert(row, { onConflict: 'user_id,date' })
  .select()
  .then(r => {
    if (r.error) {
      console.error('ERROR:', r.error.message);
      process.exit(1);
    } else {
      console.log('Diarium OK:', JSON.stringify(r.data));
    }
  })
  .catch(e => {
    console.error('EXCEPTION:', e.message);
    process.exit(1);
  });