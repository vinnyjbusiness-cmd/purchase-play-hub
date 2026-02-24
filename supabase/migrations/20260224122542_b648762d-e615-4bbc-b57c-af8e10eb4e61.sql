
-- Add login detail fields to inventory table
ALTER TABLE public.inventory
ADD COLUMN first_name text,
ADD COLUMN last_name text,
ADD COLUMN email text,
ADD COLUMN password text;
