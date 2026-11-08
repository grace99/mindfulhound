CREATE TABLE public.account_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  disabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_status TO authenticated;
GRANT ALL ON public.account_status TO service_role;
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own account status" ON public.account_status FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT COALESCE((SELECT disabled FROM public.account_status WHERE user_id = _user_id), false)
$$;
REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.initialize_user_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN lower(COALESCE(NEW.email, '')) = lower('gopinathr.r@gmail.com') THEN 'admin' ELSE 'user' END)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.account_status (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_user_account() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT COALESCE((SELECT disabled FROM public.account_status WHERE user_id = _user_id), false)
$$;

ALTER TABLE public.p_dlyexp ADD COLUMN legacy_uid bigint;
CREATE UNIQUE INDEX p_dlyexp_owner_legacy_uid_key ON public.p_dlyexp (owner_id, legacy_uid);
DROP POLICY "Users manage own expenses" ON public.p_dlyexp;
DROP POLICY "Administrators manage all expenses" ON public.p_dlyexp;
CREATE POLICY "Active users manage own expenses" ON public.p_dlyexp FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_account_active(auth.uid())) WITH CHECK (owner_id = auth.uid() AND public.is_account_active(auth.uid()));
CREATE POLICY "Active administrators manage all expenses" ON public.p_dlyexp FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.is_account_active(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.is_account_active(auth.uid()));
