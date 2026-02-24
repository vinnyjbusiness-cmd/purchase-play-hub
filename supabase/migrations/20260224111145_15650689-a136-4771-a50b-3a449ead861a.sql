
-- Add SWIFT/BIC and IBAN columns to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS swift_bic text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS iban text;

-- Add SWIFT/BIC and IBAN columns to invoice_settings
ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS swift_bic text;
ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS iban text;
