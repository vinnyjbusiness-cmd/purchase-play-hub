
-- Create todos table
CREATE TABLE public.todos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  assigned_to uuid,
  created_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- All org members can view todos
CREATE POLICY "Org members can view todos"
ON public.todos FOR SELECT
USING (is_org_member(auth.uid(), org_id));

-- All org members can create todos
CREATE POLICY "Org members can create todos"
ON public.todos FOR INSERT
WITH CHECK (is_org_member(auth.uid(), org_id));

-- All org members can update todos
CREATE POLICY "Org members can update todos"
ON public.todos FOR UPDATE
USING (is_org_member(auth.uid(), org_id));

-- All org members can delete todos
CREATE POLICY "Org members can delete todos"
ON public.todos FOR DELETE
USING (is_org_member(auth.uid(), org_id));

-- Trigger for updated_at
CREATE TRIGGER update_todos_updated_at
BEFORE UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
