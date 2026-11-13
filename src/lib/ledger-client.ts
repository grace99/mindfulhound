import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/ledger-types";
import { LEDGER_PUBLISHABLE_KEY, LEDGER_SUPABASE_URL } from "./ledger-config";

export const supabase = createClient<Database>(LEDGER_SUPABASE_URL, LEDGER_PUBLISHABLE_KEY);
