
-- Invoice settings (saved business details template)
CREATE TABLE public.invoice_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) NOT NULL UNIQUE,
  business_name text,
  business_address text,
  business_email text,
  business_phone text,
  bank_name text,
  account_name text,
  account_number text,
  sort_code text,
  payment_terms text DEFAULT 'Payment due within 14 days',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoice settings"
ON public.invoice_settings FOR SELECT
USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can manage invoice settings"
ON public.invoice_settings FOR ALL
USING (is_org_admin(auth.uid(), org_id));

CREATE TRIGGER update_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  invoice_number integer NOT NULL DEFAULT 1,
  invoice_date timestamp with time zone NOT NULL DEFAULT now(),
  due_date timestamp with time zone,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  -- Sender
  sender_name text,
  sender_address text,
  sender_email text,
  sender_phone text,
  -- Recipient
  recipient_name text,
  recipient_address text,
  recipient_email text,
  -- Line items stored as JSONB
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  -- Payment & notes
  bank_name text,
  account_name text,
  account_number text,
  sort_code text,
  notes text,
  payment_terms text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoices"
ON public.invoices FOR SELECT
USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can manage invoices"
ON public.invoices FOR ALL
USING (is_org_admin(auth.uid(), org_id));

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
