
-- Add logo_url column to suppliers and platforms
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Allow authenticated users to update/delete their logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);
