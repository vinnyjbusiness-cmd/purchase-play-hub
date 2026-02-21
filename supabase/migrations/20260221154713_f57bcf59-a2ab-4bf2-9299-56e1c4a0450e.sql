
-- Allow balance_payments to be unassigned (no party yet)
ALTER TABLE public.balance_payments ALTER COLUMN party_id DROP NOT NULL;
ALTER TABLE public.balance_payments ALTER COLUMN party_type DROP NOT NULL;

-- Add contact_name for Trade-type suppliers
ALTER TABLE public.balance_payments ADD COLUMN contact_name text;
