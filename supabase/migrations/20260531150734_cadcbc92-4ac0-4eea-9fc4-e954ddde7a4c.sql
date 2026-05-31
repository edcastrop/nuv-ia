-- Fix: storage policies for colab-adjuntos bucket
-- Reason: `owner = auth.uid()` is unreliable on INSERT (owner is set after RLS).
-- Use folder-prefix check that matches our upload path: `${user_id}/${canalId}/...`

DROP POLICY IF EXISTS "colab adjuntos insert" ON storage.objects;
DROP POLICY IF EXISTS "colab adjuntos select" ON storage.objects;
DROP POLICY IF EXISTS "colab adjuntos delete" ON storage.objects;

CREATE POLICY "colab adjuntos insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'colab-adjuntos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "colab adjuntos select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'colab-adjuntos');

CREATE POLICY "colab adjuntos update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'colab-adjuntos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "colab adjuntos delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'colab-adjuntos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);