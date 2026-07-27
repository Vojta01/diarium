import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client for browser-side auth (login, OAuth, session exchange).
 * Uses localStorage storage so PKCE code_verifier survives OAuth redirects
 * (cookies can be lost on cross-site redirects, especially on mobile).
 */
export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Force localStorage instead of default sessionStorage.
      // sessionStorage is lost when OAuth opens in external browser on mobile,
      // causing "PKCE code verifier not found" errors.
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
}

/**
 * SSR-compatible client that stores session in cookies.
 * Used by middleware and for setting cookies after successful auth.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
