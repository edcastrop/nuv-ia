
-- Storage: bucket "extractos" — habilitar acceso a director_financiero_qa
DROP POLICY IF EXISTS "Extractos: select own or admin" ON storage.objects;
DROP POLICY IF EXISTS "Extractos: update own or admin" ON storage.objects;
DROP POLICY IF EXISTS "Extractos: delete own or admin" ON storage.objects;

CREATE POLICY "Extractos: select own or admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'extractos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gerencia'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
    )
  );

CREATE POLICY "Extractos: update own or admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'extractos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gerencia'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
    )
  );

CREATE POLICY "Extractos: delete own or admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'extractos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gerencia'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
    )
  );

-- Storage: bucket "soportes-banco" — habilitar acceso a director_financiero_qa
DROP POLICY IF EXISTS "Soportes banco select" ON storage.objects;
DROP POLICY IF EXISTS "Soportes banco update" ON storage.objects;
DROP POLICY IF EXISTS "Soportes banco delete" ON storage.objects;

CREATE POLICY "Soportes banco select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'soportes-banco'
    AND EXISTS (
      SELECT 1 FROM expedientes e
      WHERE (e.id)::text = (storage.foldername(objects.name))[1]
        AND (
          e.asesor_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerencia'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'juridica'::app_role)
          OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
        )
    )
  );

CREATE POLICY "Soportes banco update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'soportes-banco'
    AND EXISTS (
      SELECT 1 FROM expedientes e
      WHERE (e.id)::text = (storage.foldername(objects.name))[1]
        AND (
          e.asesor_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerencia'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
        )
    )
  );

CREATE POLICY "Soportes banco delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'soportes-banco'
    AND EXISTS (
      SELECT 1 FROM expedientes e
      WHERE (e.id)::text = (storage.foldername(objects.name))[1]
        AND (
          e.asesor_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerencia'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
        )
    )
  );
