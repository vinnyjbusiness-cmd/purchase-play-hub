
-- Make purchase_id nullable since inventory doesn't require purchases
ALTER TABLE public.inventory ALTER COLUMN purchase_id DROP NOT NULL;

-- Add new columns
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS ticket_name text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS supporter_id text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS iphone_pass_link text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS android_pass_link text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pk_pass_url text;
