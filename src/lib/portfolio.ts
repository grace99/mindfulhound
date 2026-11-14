import { supabase } from "./ledger-client";
import type { Asset, Valuation, Handover, AssetInput, ImportRow } from "./portfolio-model";
import { joinHoldings } from "./portfolio-model";
import type { Json } from "@/integrations/supabase/types";

// Page each table so a REST row cap cannot silently distort portfolio totals.
async function allRows<T>(
  table: "portfolio_assets" | "portfolio_valuations" | "portfolio_handover",
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(table === "portfolio_handover" ? "asset_id" : "id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as T[]));
    if ((data?.length ?? 0) < 1000) return rows;
  }
  throw new Error("Your portfolio is too large to load completely. No partial totals are shown.");
}
export async function fetchPortfolio() {
  const [assets, valuations, handover] = await Promise.all([
    allRows<Asset>("portfolio_assets"),
    allRows<Valuation>("portfolio_valuations"),
    allRows<Handover>("portfolio_handover"),
  ]);
  return { holdings: joinHoldings(assets, valuations, handover), valuations };
}
export async function saveHolding(
  id: string | null,
  asset: AssetInput,
  valuation: Pick<Valuation, "valued_on" | "cost_inr" | "value_inr">,
  handover: typeof import("./portfolio-model").emptyHandover,
) {
  const { data, error } = await supabase.rpc("save_portfolio_asset", {
    _id: id,
    _asset: asset as Json,
    _valuation: valuation as Json,
    _handover: handover as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function importHoldings(items: ImportRow[], valuedOn: string) {
  const { data, error } = await supabase.rpc("import_portfolio_assets", {
    _items: items as Json,
    _valued_on: valuedOn,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function deleteHolding(id: string) {
  const { data, error } = await supabase
    .from("portfolio_assets")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
