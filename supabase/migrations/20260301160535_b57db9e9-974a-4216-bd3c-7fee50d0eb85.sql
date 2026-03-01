
-- Add pass link columns to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS iphone_pass_link text,
  ADD COLUMN IF NOT EXISTS android_pass_link text,
  ADD COLUMN IF NOT EXISTS pk_pass_url text;

-- Create pkpass-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pkpass-files', 'pkpass-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload and read
CREATE POLICY "Authenticated users can upload pkpass files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pkpass-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read pkpass files"
ON storage.objects FOR SELECT
USING (bucket_id = 'pkpass-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pkpass files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pkpass-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete pkpass files"
ON storage.objects FOR DELETE
USING (bucket_id = 'pkpass-files' AND has_role(auth.uid(), 'admin'::app_role));
