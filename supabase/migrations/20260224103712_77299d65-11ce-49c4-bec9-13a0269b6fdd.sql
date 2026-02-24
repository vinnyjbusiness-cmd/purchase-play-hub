
-- Create order_status_history table for tracking order stage transitions
CREATE TABLE public.order_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage text NOT NULL,
  reached_at timestamp with time zone NOT NULL DEFAULT now(),
  org_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order_status_history"
  ON public.order_status_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view order_status_history"
  ON public.order_status_history FOR SELECT
  USING (true);

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history(order_id);
