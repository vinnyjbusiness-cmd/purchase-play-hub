-- Fix: Enable RLS on tables that have policies but RLS disabled
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
