ALTER TABLE public.orders ADD COLUMN split_type text, ADD COLUMN block text;
ALTER TABLE public.purchases ADD COLUMN split_type text;
ALTER TABLE public.inventory ADD COLUMN split_type text;