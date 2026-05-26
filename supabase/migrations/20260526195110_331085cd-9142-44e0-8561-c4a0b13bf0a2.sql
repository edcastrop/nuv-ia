
-- Bucket privado para material de academia (PDFs, imágenes, descargables)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academia-material',
  'academia-material',
  false,
  20971520,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura: cualquier usuario autenticado puede ver el material
CREATE POLICY "Academia material read authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'academia-material');

-- Escritura/actualización/eliminación: sólo super_admin
CREATE POLICY "Academia material insert super_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'academia-material' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Academia material update super_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'academia-material' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Academia material delete super_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'academia-material' AND public.is_super_admin(auth.uid()));
