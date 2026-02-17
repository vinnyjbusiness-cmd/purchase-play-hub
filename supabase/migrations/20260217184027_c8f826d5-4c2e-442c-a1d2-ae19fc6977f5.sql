
-- Add payment tracking to purchases (paid to supplier or not)
ALTER TABLE public.purchases ADD COLUMN supplier_paid boolean NOT NULL DEFAULT false;

-- Add payment received tracking to orders
ALTER TABLE public.orders ADD COLUMN payment_received boolean NOT NULL DEFAULT false;
