
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  platform text NOT NULL,
  section text,
  "row" text,
  seat_from text,
  seat_to text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  face_value numeric,
  status text NOT NULL DEFAULT 'published',
  external_listing_id text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage listings" ON public.listings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view listings" ON public.listings FOR SELECT USING (true);

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
