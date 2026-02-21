-- Add finance PIN column to organizations
ALTER TABLE public.organizations ADD COLUMN finance_pin TEXT DEFAULT NULL;

-- Only org admins can read/update the PIN (already covered by existing policies)
