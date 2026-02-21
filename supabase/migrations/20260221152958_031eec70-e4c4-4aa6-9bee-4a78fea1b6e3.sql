
-- Table to track partial payments to/from suppliers and platforms
CREATE TABLE public.balance_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id),
  party_type TEXT NOT NULL CHECK (party_type IN ('supplier', 'platform')),
  party_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage balance_payments"
ON public.balance_payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view balance_payments"
ON public.balance_payments FOR SELECT
USING (true);

CREATE INDEX idx_balance_payments_party ON public.balance_payments(party_type, party_id);
