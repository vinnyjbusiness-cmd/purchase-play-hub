
-- Add customer details columns to orders
ALTER TABLE public.orders
ADD COLUMN buyer_name text,
ADD COLUMN buyer_phone text,
ADD COLUMN buyer_email text;
