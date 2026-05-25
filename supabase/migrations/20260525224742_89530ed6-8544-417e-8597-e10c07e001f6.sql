
-- 1. Add new enum value CONDICIONES_APLICADAS
ALTER TYPE public.expediente_estado ADD VALUE IF NOT EXISTS 'CONDICIONES_APLICADAS';

-- 2. Create expediente_soportes table
CREATE TABLE IF NOT EXISTS public.expediente_soportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'soportes_banco',
  subcategoria TEXT NOT NULL,
  archivo_nombre TEXT NOT NULL,
  archivo_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  estado_relacionado TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exp_soportes_exp ON public.expediente_soportes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_exp_soportes_sub ON public.expediente_soportes(subcategoria);

ALTER TABLE public.expediente_soportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Soportes select por owner/manager" ON public.expediente_soportes;
CREATE POLICY "Soportes select por owner/manager"
ON public.expediente_soportes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = expediente_soportes.expediente_id
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'juridica'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Soportes insert por owner/manager" ON public.expediente_soportes;
CREATE POLICY "Soportes insert por owner/manager"
ON public.expediente_soportes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = expediente_soportes.expediente_id
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Soportes delete por owner/manager" ON public.expediente_soportes;
CREATE POLICY "Soportes delete por owner/manager"
ON public.expediente_soportes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = expediente_soportes.expediente_id
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('soportes-banco', 'soportes-banco', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Soportes banco select" ON storage.objects;
CREATE POLICY "Soportes banco select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'soportes-banco'
  AND EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'juridica'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Soportes banco insert" ON storage.objects;
CREATE POLICY "Soportes banco insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'soportes-banco'
  AND EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Soportes banco delete" ON storage.objects;
CREATE POLICY "Soportes banco delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'soportes-banco'
  AND EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Soportes banco update" ON storage.objects;
CREATE POLICY "Soportes banco update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'soportes-banco'
  AND EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND (
        e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);
