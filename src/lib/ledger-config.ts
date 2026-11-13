// App-owned configuration: Lovable may inject SUPABASE_* for its separate Cloud
// project. Never use those values for this ledger or mix authentication projects.
export const LEDGER_PROJECT_ID = "jaellgweggisthweiabv";
export const LEDGER_SUPABASE_URL = `https://${LEDGER_PROJECT_ID}.supabase.co`;
// Supabase publishable keys identify a project; authorization is enforced by RLS.
export const LEDGER_PUBLISHABLE_KEY = "sb_publishable_IgY-8SFD-fVgeoZ4TLAJEQ_cyNJPoeW";
