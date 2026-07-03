import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton — jedna instance napříč celou appkou
let _client: ReturnType<typeof createClient> | null = null;

export function createSupabaseClient() {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // automaticky detekuje hash fragment
      },
    });
  }
  return _client;
}
