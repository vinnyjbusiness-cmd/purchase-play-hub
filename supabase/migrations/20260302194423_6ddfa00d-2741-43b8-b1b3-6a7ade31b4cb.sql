
-- Team invites table
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  role_label text NOT NULL DEFAULT 'Member',
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status text NOT NULL DEFAULT 'pending',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team_invites"
  ON public.team_invites FOR ALL
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Anyone can read invite by token"
  ON public.team_invites FOR SELECT
  USING (true);

-- Team members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role_label text NOT NULL DEFAULT 'Member',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  training_completed boolean NOT NULL DEFAULT false,
  training_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team_members"
  ON public.team_members FOR ALL
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Members can read own record"
  ON public.team_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members can update own record"
  ON public.team_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
