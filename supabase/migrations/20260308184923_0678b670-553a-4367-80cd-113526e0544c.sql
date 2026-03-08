
-- ============================================================
-- FIX 1: Cross-org data exposure - Replace permissive SELECT policies
-- ============================================================

-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view purchases" ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view platforms" ON public.platforms;
DROP POLICY IF EXISTS "Authenticated users can view payouts" ON public.payouts;
DROP POLICY IF EXISTS "Authenticated users can view ledger" ON public.transactions_ledger;
DROP POLICY IF EXISTS "Authenticated users can view refunds" ON public.refunds;
DROP POLICY IF EXISTS "Authenticated users can view order_lines" ON public.order_lines;
DROP POLICY IF EXISTS "Authenticated users can view balance_payments" ON public.balance_payments;
DROP POLICY IF EXISTS "Authenticated users can view members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can view virtual cards" ON public.platform_virtual_cards;
DROP POLICY IF EXISTS "Authenticated users can view ijk_payments" ON public.ijk_payments;
DROP POLICY IF EXISTS "Authenticated users can view ijk_replacements" ON public.ijk_replacements;
DROP POLICY IF EXISTS "Authenticated users can view ijk_settlements" ON public.ijk_settlements;
DROP POLICY IF EXISTS "Authenticated users can view order_status_history" ON public.order_status_history;

-- Create org-scoped SELECT policies
CREATE POLICY "Members can view org events" ON public.events
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org orders" ON public.orders
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org purchases" ON public.purchases
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org inventory" ON public.inventory
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org platforms" ON public.platforms
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org payouts" ON public.payouts
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org ledger" ON public.transactions_ledger
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org refunds" ON public.refunds
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org order_lines" ON public.order_lines
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_lines.order_id
      AND is_org_member(auth.uid(), orders.org_id)
    )
  );

CREATE POLICY "Members can view org balance_payments" ON public.balance_payments
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org members" ON public.members
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org virtual_cards" ON public.platform_virtual_cards
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org ijk_payments" ON public.ijk_payments
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org ijk_replacements" ON public.ijk_replacements
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org ijk_settlements" ON public.ijk_settlements
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members can view org order_status_history" ON public.order_status_history
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

-- ============================================================
-- FIX 1b: Replace admin write policies with org-scoped versions
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can manage platforms" ON public.platforms;
DROP POLICY IF EXISTS "Admins can manage payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can manage ledger" ON public.transactions_ledger;
DROP POLICY IF EXISTS "Admins can manage refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admins can manage order_lines" ON public.order_lines;
DROP POLICY IF EXISTS "Admins can manage balance_payments" ON public.balance_payments;
DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
DROP POLICY IF EXISTS "Admins can manage virtual cards" ON public.platform_virtual_cards;
DROP POLICY IF EXISTS "Admins can manage ijk_payments" ON public.ijk_payments;
DROP POLICY IF EXISTS "Admins can manage ijk_replacements" ON public.ijk_replacements;
DROP POLICY IF EXISTS "Admins can manage ijk_settlements" ON public.ijk_settlements;
DROP POLICY IF EXISTS "Admins can manage order_status_history" ON public.order_status_history;

CREATE POLICY "Org admins can manage events" ON public.events
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage orders" ON public.orders
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage purchases" ON public.purchases
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage inventory" ON public.inventory
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage platforms" ON public.platforms
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage payouts" ON public.payouts
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage ledger" ON public.transactions_ledger
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage refunds" ON public.refunds
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage order_lines" ON public.order_lines
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_lines.order_id AND is_org_admin(auth.uid(), orders.org_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_lines.order_id AND is_org_admin(auth.uid(), orders.org_id))
  );

CREATE POLICY "Org admins can manage balance_payments" ON public.balance_payments
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage members" ON public.members
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage virtual_cards" ON public.platform_virtual_cards
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage ijk_payments" ON public.ijk_payments
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage ijk_replacements" ON public.ijk_replacements
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage ijk_settlements" ON public.ijk_settlements
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can manage order_status_history" ON public.order_status_history
  FOR ALL TO authenticated USING (is_org_admin(auth.uid(), org_id)) WITH CHECK (is_org_admin(auth.uid(), org_id));

-- ============================================================
-- FIX 2: Explicit deny on user_roles write operations
-- ============================================================

CREATE POLICY "Deny direct role insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Deny direct role update" ON public.user_roles
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Deny direct role delete" ON public.user_roles
  FOR DELETE TO authenticated USING (false);
