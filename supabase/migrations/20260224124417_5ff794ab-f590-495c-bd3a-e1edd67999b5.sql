
-- Add due_date to todos for scheduling tasks on specific dates
ALTER TABLE public.todos ADD COLUMN due_date date NULL;

-- Create sent_emails table for communications history
CREATE TABLE public.sent_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  subject text NOT NULL,
  body text NOT NULL,
  recipient_user_ids uuid[] NOT NULL DEFAULT '{}',
  sent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sent_emails"
ON public.sent_emails
FOR SELECT
USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert sent_emails"
ON public.sent_emails
FOR INSERT
WITH CHECK (is_org_member(auth.uid(), org_id));
