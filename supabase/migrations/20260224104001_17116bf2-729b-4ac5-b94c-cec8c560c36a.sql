
-- Create email_rules table for automated email rules
CREATE TABLE public.email_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  trigger_type text NOT NULL, -- 'unactioned_order', 'weekly_summary', 'custom'
  trigger_config jsonb NOT NULL DEFAULT '{}', -- e.g. {"days": 3} or {"day_of_week": "monday"}
  recipient_user_ids uuid[] NOT NULL DEFAULT '{}',
  subject_template text NOT NULL,
  body_template text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_rules"
  ON public.email_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org members can view email_rules"
  ON public.email_rules FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE TRIGGER update_email_rules_updated_at
  BEFORE UPDATE ON public.email_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
