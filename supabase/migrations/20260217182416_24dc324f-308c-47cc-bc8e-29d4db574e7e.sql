
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');
CREATE TYPE public.currency_code AS ENUM ('GBP', 'USD', 'EUR');
CREATE TYPE public.purchase_status AS ENUM ('pending', 'confirmed', 'received', 'cancelled');
CREATE TYPE public.inventory_status AS ENUM ('available', 'reserved', 'sold', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('pending', 'fulfilled', 'delivered', 'refunded', 'cancelled');
CREATE TYPE public.delivery_type AS ENUM ('email', 'physical', 'mobile_transfer', 'will_call', 'instant');
CREATE TYPE public.transaction_type AS ENUM ('sale', 'purchase', 'fee', 'refund', 'payout', 'supplier_payment', 'adjustment');
CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.refund_status AS ENUM ('pending', 'approved', 'completed', 'rejected');

-- Profiles (basic user info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Auto-create profile + admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_code TEXT NOT NULL,
  competition TEXT NOT NULL DEFAULT 'World Cup 2026',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  venue TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Platforms
CREATE TABLE public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fee_type TEXT DEFAULT 'percentage',
  fee_value NUMERIC(10,4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view platforms" ON public.platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage platforms" ON public.platforms FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  event_id UUID REFERENCES public.events(id) NOT NULL,
  supplier_order_id TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  section TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL,
  fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost + fees) STORED,
  currency currency_code NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0,
  total_cost_gbp NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_cost + fees) * 1.0) STORED,
  status purchase_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view purchases" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage purchases" ON public.purchases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES public.purchases(id) NOT NULL,
  event_id UUID REFERENCES public.events(id) NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  section TEXT,
  row_name TEXT,
  seat TEXT,
  status inventory_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage inventory" ON public.inventory FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Orders (Sales)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES public.platforms(id),
  event_id UUID REFERENCES public.events(id) NOT NULL,
  order_ref TEXT,
  buyer_ref TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  quantity INT NOT NULL DEFAULT 1,
  sale_price NUMERIC(12,2) NOT NULL,
  fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_received NUMERIC(12,2) GENERATED ALWAYS AS (sale_price - fees) STORED,
  currency currency_code NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0,
  status order_status NOT NULL DEFAULT 'pending',
  delivery_type delivery_type NOT NULL DEFAULT 'email',
  delivery_status TEXT DEFAULT 'pending',
  notes TEXT,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Order Lines (links orders to inventory)
CREATE TABLE public.order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  inventory_id UUID REFERENCES public.inventory(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view order_lines" ON public.order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage order_lines" ON public.order_lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Transactions Ledger
CREATE TABLE public.transactions_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type transaction_type NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency currency_code NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0,
  amount_gbp NUMERIC(12,2) NOT NULL,
  event_id UUID REFERENCES public.events(id),
  platform_id UUID REFERENCES public.platforms(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view ledger" ON public.transactions_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage ledger" ON public.transactions_ledger FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES public.platforms(id) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency currency_code NOT NULL DEFAULT 'GBP',
  status payout_status NOT NULL DEFAULT 'pending',
  payout_date TIMESTAMPTZ,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view payouts" ON public.payouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage payouts" ON public.payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Refunds
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'pending',
  refund_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view refunds" ON public.refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage refunds" ON public.refunds FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
