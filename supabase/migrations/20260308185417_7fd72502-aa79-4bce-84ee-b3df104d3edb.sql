
ALTER TABLE public.events ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.orders ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.purchases ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.inventory ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.suppliers ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.platforms ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.payouts ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.transactions_ledger ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.refunds ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.balance_payments ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.members ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.platform_virtual_cards ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.ijk_payments ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.ijk_replacements ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.ijk_settlements ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
ALTER TABLE public.order_status_history ALTER COLUMN org_id SET DEFAULT (get_user_org_id(auth.uid()));
