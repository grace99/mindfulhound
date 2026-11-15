BEGIN;
CREATE TABLE public.portfolio_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.ledger_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  term text NOT NULL CHECK (term IN ('short','long')),
  target_inr numeric(16,2) NOT NULL CHECK (target_inr > 0 AND target_inr <= 9999999999999.99),
  target_date date NOT NULL CHECK (target_date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  priority integer NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 9999),
  expected_return_pct numeric(6,3) NOT NULL DEFAULT 0 CHECK (expected_return_pct BETWEEN -99 AND 100),
  inflation_pct numeric(6,3) NOT NULL DEFAULT 0 CHECK (inflation_pct BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_goals_owner_idx ON public.portfolio_goals(owner_id);
ALTER TABLE public.portfolio_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_goals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_goals TO authenticated;
GRANT ALL ON public.portfolio_goals TO service_role;
CREATE POLICY "Active users manage own portfolio goals" ON public.portfolio_goals FOR ALL TO authenticated
USING (owner_id=auth.uid() AND public.ledger_is_account_active(auth.uid()))
WITH CHECK (owner_id=auth.uid() AND public.ledger_is_account_active(auth.uid()));
-- Disable the existing bulk import endpoint as well as its UI.
REVOKE EXECUTE ON FUNCTION public.import_portfolio_assets(jsonb,date) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
