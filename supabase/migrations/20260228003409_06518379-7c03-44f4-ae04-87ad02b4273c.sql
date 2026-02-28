
CREATE TABLE public.platform_virtual_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id),
  card_name text NOT NULL DEFAULT '',
  card_number text NOT NULL DEFAULT '',
  expiry text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_virtual_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage virtual cards" ON public.platform_virtual_cards FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view virtual cards" ON public.platform_virtual_cards FOR SELECT USING (true);
