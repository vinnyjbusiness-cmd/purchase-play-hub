
CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view templates" ON public.message_templates FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage templates" ON public.message_templates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
