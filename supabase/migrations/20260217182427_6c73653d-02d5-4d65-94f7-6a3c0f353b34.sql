
-- Fix audit_log insert policy to restrict to authenticated users only (the true is intentional since any authenticated user's actions should be logged)
DROP POLICY "System can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
