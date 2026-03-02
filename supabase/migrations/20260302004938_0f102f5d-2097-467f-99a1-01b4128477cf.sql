
-- IJK settlements per game
CREATE TABLE public.ijk_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  org_id uuid REFERENCES public.organizations(id),
  status text NOT NULL DEFAULT 'pending',
  ijk_share numeric NOT NULL DEFAULT 0,
  vinny_share numeric NOT NULL DEFAULT 0,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- IJK payments (running balance adjustments)
CREATE TABLE public.ijk_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  amount numeric NOT NULL,
  direction text NOT NULL DEFAULT 'to_ijk',
  notes text,
  event_id uuid REFERENCES public.events(id),
  payment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- IJK replacement tracker for banned tickets
CREATE TABLE public.ijk_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  banned_inventory_id uuid NOT NULL REFERENCES public.inventory(id),
  replacement_inventory_id uuid REFERENCES public.inventory(id),
  replacement_cost numeric NOT NULL DEFAULT 0,
  original_cost numeric NOT NULL DEFAULT 0,
  event_id uuid NOT NULL REFERENCES public.events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for ijk_settlements
ALTER TABLE public.ijk_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ijk_settlements" ON public.ijk_settlements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view ijk_settlements" ON public.ijk_settlements FOR SELECT USING (true);

-- RLS for ijk_payments
ALTER TABLE public.ijk_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ijk_payments" ON public.ijk_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view ijk_payments" ON public.ijk_payments FOR SELECT USING (true);

-- RLS for ijk_replacements
ALTER TABLE public.ijk_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ijk_replacements" ON public.ijk_replacements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view ijk_replacements" ON public.ijk_replacements FOR SELECT USING (true);
