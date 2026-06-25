
-- 1) Columna licenciado_id en expedientes
ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS licenciado_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_licenciado_id ON public.expedientes(licenciado_id);

-- 2) RLS: licenciado asignado puede ver, actualizar y borrar su caso
DROP POLICY IF EXISTS "Licenciado sees assigned expedientes" ON public.expedientes;
CREATE POLICY "Licenciado sees assigned expedientes"
  ON public.expedientes FOR SELECT
  USING (auth.uid() = licenciado_id);

DROP POLICY IF EXISTS "Licenciado updates assigned expedientes" ON public.expedientes;
CREATE POLICY "Licenciado updates assigned expedientes"
  ON public.expedientes FOR UPDATE
  USING (auth.uid() = licenciado_id)
  WITH CHECK (auth.uid() = licenciado_id);

-- 3) Auditoría de reasignación de licenciado vive en expediente_historial (ya existe). No requiere schema extra.
