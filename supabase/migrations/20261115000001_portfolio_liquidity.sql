BEGIN;
ALTER TABLE public.portfolio_assets ADD COLUMN liquidity_status text NOT NULL DEFAULT 'locked';
UPDATE public.portfolio_assets SET liquidity_status = CASE
  WHEN position_type = 'liability' THEN 'not_applicable'
  WHEN lower(btrim(category)) = 'cash' OR redemption_kind = 'anytime' THEN 'available'
  ELSE 'locked' END;
ALTER TABLE public.portfolio_assets ADD CONSTRAINT portfolio_liquidity_status_check CHECK (
  (position_type = 'asset' AND liquidity_status IN ('available','locked','pending_redemption')) OR
  (position_type = 'liability' AND liquidity_status = 'not_applicable')
);
CREATE OR REPLACE FUNCTION public.save_portfolio_asset(_id uuid, _asset jsonb, _valuation jsonb, _handover jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  saved_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.ledger_is_account_active(auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with an active account to manage your portfolio';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.portfolio_assets (name, category, position_type, repatriable, gain_status, entered_rate_pct, redemption_kind, redemption_month, import_key, liquidity_status)
    VALUES (_asset->>'name', _asset->>'category', _asset->>'position_type', (_asset->>'repatriable')::boolean,
      _asset->>'gain_status', (_asset->>'entered_rate_pct')::numeric, _asset->>'redemption_kind', _asset->>'redemption_month', _asset->>'import_key', COALESCE(_asset->>'liquidity_status', CASE WHEN _asset->>'position_type'='liability' THEN 'not_applicable' WHEN lower(btrim(_asset->>'category'))='cash' OR _asset->>'redemption_kind'='anytime' THEN 'available' ELSE 'locked' END))
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.portfolio_assets SET name = _asset->>'name', category = _asset->>'category', position_type = _asset->>'position_type',
      repatriable = (_asset->>'repatriable')::boolean, gain_status = _asset->>'gain_status', entered_rate_pct = (_asset->>'entered_rate_pct')::numeric,
      redemption_kind = _asset->>'redemption_kind', redemption_month = _asset->>'redemption_month', updated_at = now(),
      liquidity_status = COALESCE(_asset->>'liquidity_status', CASE WHEN _asset->>'position_type'='liability' THEN 'not_applicable' WHEN liquidity_status='not_applicable' THEN 'locked' ELSE liquidity_status END)
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

NOTIFY pgrst, 'reload schema';
COMMIT;
