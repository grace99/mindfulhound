import { legacySupabase } from "@/lib/legacy-supabase";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_SIZE = 500;

/** Copies legacy rows into the current account and never writes to the source ledger. */
export const copyLegacyLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [role, status] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("is_account_active", { _user_id: userId }),
    ]);
    if (role.error || status.error || !role.data || !status.data) {
      throw new Error("Only active administrators can copy the shared ledger.");
    }

    let copied = 0;
    for (let page = 0; page < 100; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await legacySupabase
        .from("p_dlyexp")
        .select(
          "uid, tran_date, cal_day, month, nth_yr, location, country, exp_desc, exp_type, exp_subtyp, exclude, bad_choice, crcy, abs_amt, t_amt",
        )
        .order("uid", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(`Could not read the original ledger: ${error.message}`);
      const sourceRows = data ?? [];
      if (sourceRows.length === 0) break;

      const copies = sourceRows.map(({ uid, ...expense }) => ({
        ...expense,
        legacy_uid: Number(uid),
      }));
      const { data: inserted, error: insertError } = await supabase
        .from("p_dlyexp")
        .upsert(copies, {
          onConflict: "owner_id,legacy_uid",
          ignoreDuplicates: true,
        })
        .select("legacy_uid");

      if (insertError) throw new Error(`Copy paused after ${copied} rows: ${insertError.message}`);
      copied += inserted?.length ?? 0;
      if (sourceRows.length < PAGE_SIZE) break;
    }

    return copied;
  });
