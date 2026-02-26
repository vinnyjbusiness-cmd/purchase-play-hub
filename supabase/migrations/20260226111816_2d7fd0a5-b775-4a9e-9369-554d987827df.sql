-- Update the display_id sequence prefix from SUP- to CON- for new records
CREATE OR REPLACE FUNCTION public.set_supplier_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := 'CON-' || LPAD(nextval('public.supplier_display_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;