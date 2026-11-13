import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/ledger-types";
import { LEDGER_PUBLISHABLE_KEY, LEDGER_SUPABASE_URL } from "./ledger-config";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authorization = getRequest().headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Sign in to continue.");
    const token = authorization.slice(7);
    if (!token || token.split(".").length !== 3) throw new Error("Invalid session. Sign in again.");
    const supabase = createClient<Database>(LEDGER_SUPABASE_URL, LEDGER_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Validate with the destination project's Auth service, never the old Cloud project.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Invalid session. Sign in again.");
    return next({ context: { supabase, userId: data.user.id } });
  },
);
