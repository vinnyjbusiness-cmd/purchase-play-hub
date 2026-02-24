
-- Add metadata column to audit_log for device/browser info
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Drop existing audit triggers if any, then recreate on ALL tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'orders','purchases','inventory','events','platforms','suppliers',
    'balance_payments','payouts','refunds','transactions_ledger',
    'org_members','invitations','organizations','todos','invoices',
    'invoice_settings','email_rules','sent_emails','profiles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit()',
      tbl, tbl
    );
  END LOOP;
END $$;
