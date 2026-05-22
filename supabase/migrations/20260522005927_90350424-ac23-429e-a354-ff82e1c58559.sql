
INSERT INTO storage.buckets (id, name, public)
VALUES ('extractos', 'extractos', false)
ON CONFLICT (id) DO NOTHING;

-- Asesor: ver sus propios archivos (admin/gerencia también)
CREATE POLICY "Extractos: select own or admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'extractos'
  AND (
    (auth.uid()::text = (storage.foldername(name))[1])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerencia'::public.app_role)
  )
);

CREATE POLICY "Extractos: insert own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'extractos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Extractos: update own or admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'extractos'
  AND (
    (auth.uid()::text = (storage.foldername(name))[1])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerencia'::public.app_role)
  )
);

CREATE POLICY "Extractos: delete own or admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'extractos'
  AND (
    (auth.uid()::text = (storage.foldername(name))[1])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerencia'::public.app_role)
  )
);
