
ALTER TABLE public.orders ADD COLUMN device_type text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN contacted boolean NOT NULL DEFAULT false;
