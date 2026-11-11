import { legacySupabase } from "@/lib/legacy-supabase";
import { supabase } from "@/integrations/supabase/client";
import type { Expense } from "@/lib/expenses";

const PAGE_SIZE = 500;

type LegacyExpense = Omit<Expense, "uid" | "owner_id" | "legacy_uid">;

/** Copies legacy rows into the current account and never writes to the source ledger. */
export async function copyLegacyLedger(onProgress: (copied: number) => void) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in before copying your ledger.");

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

    const copies = sourceRows.map((row) => ({
      ...(row as LegacyExpense),
      legacy_uid: Number(row.uid),
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
    onProgress(copied);
    if (sourceRows.length < PAGE_SIZE) break;
  }

  return copied;
}