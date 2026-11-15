import type { Goal } from "./portfolio-goals";
import type { Asset, Valuation, Handover } from "./portfolio-model";
import type { Json } from "@/integrations/supabase/types";
type PortfolioTable<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
import type { Database as CloudDatabase } from "@/integrations/supabase/types";

type Public = CloudDatabase["public"];
// Reuse the expense field shapes without coupling this app to another
// application's existing public.profiles/user_roles tables in the project.
export type Database = Omit<CloudDatabase, "public"> & {
  public: Omit<Public, "Tables" | "Functions"> & {
    Tables: {
      portfolio_goals: PortfolioTable<Goal>;
      portfolio_assets: PortfolioTable<Asset>;
      portfolio_valuations: PortfolioTable<Valuation>;
      portfolio_handover: PortfolioTable<Handover>;
      p_dlyexp: Omit<Public["Tables"]["p_dlyexp"], "Relationships"> & {
        Relationships: [
          {
            foreignKeyName: "p_dlyexp_ledger_owner_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "ledger_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_profiles: Public["Tables"]["profiles"];
      ledger_user_roles: Public["Tables"]["user_roles"];
      ledger_account_status: Public["Tables"]["account_status"];
    };
    Functions: {
      save_portfolio_asset: {
        Args: { _id: string | null; _asset: Json; _valuation: Json; _handover: Json };
        Returns: string;
      };
      import_portfolio_assets: { Args: { _items: Json; _valued_on: string }; Returns: number };
      ledger_has_role: Public["Functions"]["has_role"];
      ledger_is_account_active: Public["Functions"]["is_account_active"];
    };
  };
};
