
CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  supporter_id text,
  email text,
  member_password text,
  email_password text,
  phone_number text,
  date_of_birth date,
  postcode text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage members" ON public.members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view members" ON public.members FOR SELECT USING (true);
