
ALTER TABLE public.balance_payments
ADD COLUMN type TEXT NOT NULL DEFAULT 'payment'
CHECK (type IN ('payment', 'opening_balance', 'adjustment'));
