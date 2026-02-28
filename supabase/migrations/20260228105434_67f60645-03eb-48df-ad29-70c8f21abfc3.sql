
-- Create vault_settings table (stores vault PIN per org)
CREATE TABLE public.vault_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  vault_pin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vault_settings"
  ON public.vault_settings FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

-- Create password_vault table
CREATE TABLE public.password_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  url text,
  username text NOT NULL,
  password text NOT NULL,
  icon_color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage password_vault"
  ON public.password_vault FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

-- Auto-update updated_at triggers
CREATE TRIGGER update_vault_settings_updated_at
  BEFORE UPDATE ON public.vault_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_password_vault_updated_at
  BEFORE UPDATE ON public.password_vault
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
