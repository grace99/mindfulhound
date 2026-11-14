BEGIN;
CREATE TABLE public.portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.ledger_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 240),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
  position_type text NOT NULL DEFAULT 'asset' CHECK (position_type IN ('asset', 'liability')),
  repatriable boolean,
  gain_status text NOT NULL DEFAULT 'unspecified' CHECK (gain_status IN ('realized', 'unrealized', 'unspecified')),
  entered_rate_pct numeric(10,4) CHECK (entered_rate_pct BETWEEN -100 AND 10000),
  redemption_kind text NOT NULL DEFAULT 'unspecified' CHECK (redemption_kind IN ('anytime', 'month', 'unspecified')),
  redemption_month text CHECK (redemption_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND redemption_month BETWEEN '1900-01' AND '2200-12'),
  import_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, import_key),
  CHECK ((redemption_kind = 'month' AND redemption_month IS NOT NULL) OR (redemption_kind <> 'month' AND redemption_month IS NULL))
);
CREATE TABLE public.portfolio_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  valued_on date NOT NULL CHECK (valued_on BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  cost_inr numeric(16,2) CHECK (cost_inr BETWEEN 0 AND 9999999999999.99),
  value_inr numeric(16,2) CHECK (value_inr BETWEEN 0 AND 9999999999999.99),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (asset_id, owner_id) REFERENCES public.portfolio_assets(id, owner_id) ON DELETE CASCADE,
  UNIQUE (asset_id, owner_id, valued_on)
);
CREATE TABLE public.portfolio_handover (
  asset_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  institution text NOT NULL DEFAULT '' CHECK (length(institution) <= 240),
  masked_reference text NOT NULL DEFAULT '' CHECK (length(masked_reference) <= 120),
  contact text NOT NULL DEFAULT '' CHECK (length(contact) <= 500),
  document_location text NOT NULL DEFAULT '' CHECK (length(document_location) <= 1000),
  instructions text NOT NULL DEFAULT '' CHECK (length(instructions) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (asset_id, owner_id) REFERENCES public.portfolio_assets(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX portfolio_valuations_latest_idx ON public.portfolio_valuations (owner_id, asset_id, valued_on DESC);

ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_handover ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_assets, public.portfolio_valuations, public.portfolio_handover FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_assets, public.portfolio_valuations, public.portfolio_handover TO authenticated;
GRANT ALL ON public.portfolio_assets, public.portfolio_valuations, public.portfolio_handover TO service_role;
CREATE POLICY "Private active portfolio assets" ON public.portfolio_assets FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()))
WITH CHECK (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()));
CREATE POLICY "Private active portfolio valuations" ON public.portfolio_valuations FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()))
WITH CHECK (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()));
CREATE POLICY "Private active portfolio handover" ON public.portfolio_handover FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()))
WITH CHECK (owner_id = auth.uid() AND public.ledger_is_account_active(auth.uid()));

-- Invoker rights retain RLS. One transaction writes metadata, valuation and notes.
CREATE FUNCTION public.save_portfolio_asset(_id uuid, _asset jsonb, _valuation jsonb, _handover jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  saved_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.ledger_is_account_active(auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with an active account to manage your portfolio';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.portfolio_assets (name, category, position_type, repatriable, gain_status, entered_rate_pct, redemption_kind, redemption_month, import_key)
    VALUES (_asset->>'name', _asset->>'category', _asset->>'position_type', (_asset->>'repatriable')::boolean,
      _asset->>'gain_status', (_asset->>'entered_rate_pct')::numeric, _asset->>'redemption_kind', _asset->>'redemption_month', _asset->>'import_key')
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.portfolio_assets SET name = _asset->>'name', category = _asset->>'category', position_type = _asset->>'position_type',
      repatriable = (_asset->>'repatriable')::boolean, gain_status = _asset->>'gain_status', entered_rate_pct = (_asset->>'entered_rate_pct')::numeric,
      redemption_kind = _asset->>'redemption_kind', redemption_month = _asset->>'redemption_month', updated_at = now()
    WHERE id = _id AND owner_id = auth.uid() RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RAISE EXCEPTION 'Holding not found in your portfolio'; END IF;
  END IF;
  INSERT INTO public.portfolio_valuations (asset_id, valued_on, cost_inr, value_inr)
  VALUES (saved_id, (_valuation->>'valued_on')::date, (_valuation->>'cost_inr')::numeric, (_valuation->>'value_inr')::numeric)
  ON CONFLICT (asset_id, owner_id, valued_on) DO UPDATE SET cost_inr = EXCLUDED.cost_inr, value_inr = EXCLUDED.value_inr;
  IF _handover IS NOT NULL THEN
    INSERT INTO public.portfolio_handover (asset_id, institution, masked_reference, contact, document_location, instructions)
    VALUES (saved_id, COALESCE(_handover->>'institution', ''), COALESCE(_handover->>'masked_reference', ''),
      COALESCE(_handover->>'contact', ''), COALESCE(_handover->>'document_location', ''), COALESCE(_handover->>'instructions', ''))
    ON CONFLICT (asset_id) DO UPDATE SET institution = EXCLUDED.institution, masked_reference = EXCLUDED.masked_reference,
      contact = EXCLUDED.contact, document_location = EXCLUDED.document_location, instructions = EXCLUDED.instructions, updated_at = now();
  END IF;
  RETURN saved_id;
END;
$$;
CREATE FUNCTION public.import_portfolio_assets(_items jsonb, _valued_on date)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb;
  existing_id uuid;
  key text;
  count integer := 0;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Import between 1 and 200 holdings at a time';
  END IF;
  -- Serialize repeat imports for this account; names/categories form stable keys.
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    key := md5(jsonb_build_array(lower(btrim(item->>'category')), lower(btrim(item->>'name')), item->>'position_type')::text);
    SELECT id INTO existing_id FROM public.portfolio_assets WHERE owner_id = auth.uid() AND import_key = key;
    PERFORM public.save_portfolio_asset(existing_id, item || jsonb_build_object('import_key', key),
      jsonb_build_object('valued_on', _valued_on, 'cost_inr', item->'cost_inr', 'value_inr', item->'value_inr'), NULL);
    count := count + 1;
  END LOOP;
  RETURN count;
END;
$$;
REVOKE ALL ON FUNCTION public.save_portfolio_asset(uuid, jsonb, jsonb, jsonb), public.import_portfolio_assets(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_portfolio_asset(uuid, jsonb, jsonb, jsonb), public.import_portfolio_assets(jsonb, date) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
