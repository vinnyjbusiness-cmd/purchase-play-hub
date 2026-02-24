
-- Add block and face_value columns to inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS face_value numeric;
