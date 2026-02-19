
-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_user_id uuid NOT NULL
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Organization members
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 3. Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 4. Add org_id to all data tables
ALTER TABLE public.events ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.orders ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.purchases ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.inventory ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.suppliers ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.platforms ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.payouts ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.transactions_ledger ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.refunds ADD COLUMN org_id uuid REFERENCES public.organizations(id);

-- 5. Add payout_days to platforms for cashflow calendar
ALTER TABLE public.platforms ADD COLUMN payout_days integer NOT NULL DEFAULT 7;

-- 6. Helper function: get user's current org
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = _user_id LIMIT 1
$$;

-- 7. Helper: check if user is member of org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id)
$$;

-- 8. Helper: check org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id AND role = 'admin')
$$;

-- 9. RLS for organizations
CREATE POLICY "Members can view their org" ON public.organizations FOR SELECT USING (
  is_org_member(auth.uid(), id)
);
CREATE POLICY "Owner can update org" ON public.organizations FOR UPDATE USING (
  owner_user_id = auth.uid()
);
CREATE POLICY "Auth users can create org" ON public.organizations FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 10. RLS for org_members
CREATE POLICY "Members can view org members" ON public.org_members FOR SELECT USING (
  is_org_member(auth.uid(), org_id)
);
CREATE POLICY "Org admins can manage members" ON public.org_members FOR ALL USING (
  is_org_admin(auth.uid(), org_id)
);

-- 11. RLS for invitations
CREATE POLICY "Org admins can manage invitations" ON public.invitations FOR ALL USING (
  is_org_admin(auth.uid(), org_id)
);
CREATE POLICY "Invitees can view their invitations" ON public.invitations FOR SELECT USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 12. Update handle_new_user to auto-create org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  pending_invite RECORD;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  -- Check if user was invited to an org
  SELECT * INTO pending_invite FROM public.invitations 
  WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;
  
  IF pending_invite IS NOT NULL THEN
    -- Join existing org
    INSERT INTO public.org_members (org_id, user_id, role) 
    VALUES (pending_invite.org_id, NEW.id, pending_invite.role);
    UPDATE public.invitations SET status = 'accepted' WHERE id = pending_invite.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, pending_invite.role);
  ELSE
    -- Create new org for user
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)) || '''s Team',
      replace(gen_random_uuid()::text, '-', '')
    , NEW.id)
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.org_members (org_id, user_id, role) VALUES (new_org_id, NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 13. Create org + membership for existing user data
-- We'll do this via insert tool after migration
