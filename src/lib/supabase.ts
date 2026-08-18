import { createClient } from "@supabase/supabase-js";

/**
 * Connected Supabase project (jaellgweggisthweiabv).
 * The URL and the publishable/anon key are public values by design.
 * They can be overridden with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
 */
export const SUPABASE_URL =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ??
  "https://jaellgweggisthweiabv.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ??
  (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined) ??
  "";

export const isSupabaseConfigured = SUPABASE_PUBLISHABLE_KEY.length > 0;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});
