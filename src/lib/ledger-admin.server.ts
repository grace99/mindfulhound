import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/ledger-types";
import { LEDGER_SUPABASE_URL } from "./ledger-config";

export function getLedgerAdminClient() {
  // Never fall back to Lovable Cloud's SUPABASE_SERVICE_ROLE_KEY.
  const key = process.env["LEDGER_SUPABASE_SERVICE_ROLE_KEY"];
  if (!key)
    throw new Error(
      "Account administration requires LEDGER_SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  return createClient<Database>(LEDGER_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
