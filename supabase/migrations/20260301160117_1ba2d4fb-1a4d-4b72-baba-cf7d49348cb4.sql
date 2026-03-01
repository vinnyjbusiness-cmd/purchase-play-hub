
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS pass_link text,
ADD COLUMN IF NOT EXISTS platform_login_url text;
