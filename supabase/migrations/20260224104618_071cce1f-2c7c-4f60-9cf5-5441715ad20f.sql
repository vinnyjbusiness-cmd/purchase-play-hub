
-- Add auto-incrementing display_id to suppliers (SUP-001, SUP-002 format)
ALTER TABLE public.suppliers ADD COLUMN display_id text;

-- Create a sequence for supplier IDs
CREATE SEQUENCE IF NOT EXISTS public.supplier_display_seq START 1;

-- Backfill existing suppliers
UPDATE public.suppliers
SET display_id = 'SUP-' || LPAD(nextval('public.supplier_display_seq')::text, 3, '0')
WHERE display_id IS NULL;

-- Set default for new suppliers
CREATE OR REPLACE FUNCTION public.set_supplier_display_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := 'SUP-' || LPAD(nextval('public.supplier_display_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supplier_display_id
BEFORE INSERT ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_display_id();
