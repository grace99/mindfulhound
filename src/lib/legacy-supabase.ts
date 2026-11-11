import { createClient } from "@supabase/supabase-js";

// Read-only source for the explicit account import flow. Never use for app CRUD.
const LEGACY_URL = "https://jaellgweggisthweiabv.supabase.co";
const LEGACY_PUBLISHABLE_KEY = "sb_publishable_IgY-8SFD-fVgeoZ4TLAJEQ_cyNJPoeW";

export const legacySupabase = createClient(LEGACY_URL, LEGACY_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});