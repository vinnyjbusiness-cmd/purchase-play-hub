
-- Add signature_url to invoice_settings
ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS signature_url text;

-- Create storage bucket for signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload signatures
CREATE POLICY "Users can upload signatures" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signatures' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update signatures" ON storage.objects FOR UPDATE USING (bucket_id = 'signatures' AND auth.uid() IS NOT NULL);
CREATE POLICY "Signatures are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');
