-- Фото лекарства
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Supabase Storage bucket для фото
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('medicine-photos', 'medicine-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS политики для storage
CREATE POLICY "Authenticated users can upload medicine photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medicine-photos');

CREATE POLICY "Medicine photos are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'medicine-photos');

CREATE POLICY "Users can update their own uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'medicine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'medicine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
