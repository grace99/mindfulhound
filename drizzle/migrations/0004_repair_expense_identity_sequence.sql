-- Earlier imports supplied legacy IDs as primary keys, bypassing the identity
-- sequence. Preserve all rows and move the sequence past every existing ID.
-- Block expense writes until the repair completes; never rewind an ahead sequence.
LOCK TABLE public.p_dlyexp IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  identity_sequence regclass;
  highest_uid bigint;
BEGIN
  identity_sequence := pg_get_serial_sequence('public.p_dlyexp', 'uid')::regclass;
  IF identity_sequence IS NULL THEN
    RAISE EXCEPTION 'No identity sequence found for public.p_dlyexp.uid';
  END IF;

  SELECT max(uid) INTO highest_uid FROM public.p_dlyexp;
  PERFORM setval(
    identity_sequence,
    GREATEST(COALESCE(highest_uid, 1), nextval(identity_sequence)),
    true
  );
END;
$$;
