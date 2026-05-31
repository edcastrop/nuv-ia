-- 1) Columnas de trazabilidad en checklist documentos
ALTER TABLE public.expediente_checklist_documentos
  ADD COLUMN IF NOT EXISTS recibido_por uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 2) Tabla de auditoría documental
CREATE TABLE IF NOT EXISTS public.expediente_checklist_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  documento_id text NOT NULL,
  documento_nombre text NOT NULL,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  usuario_id uuid,
  usuario_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_audit_expediente
  ON public.expediente_checklist_auditoria (expediente_id, created_at DESC);

GRANT SELECT, INSERT ON public.expediente_checklist_auditoria TO authenticated;
GRANT ALL ON public.expediente_checklist_auditoria TO service_role;

ALTER TABLE public.expediente_checklist_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist audit select" ON public.expediente_checklist_auditoria
  FOR SELECT TO authenticated
  USING (can_use_checklist_docs(auth.uid()));

CREATE POLICY "checklist audit insert" ON public.expediente_checklist_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (can_use_checklist_docs(auth.uid()));

-- 3) Tabla de validación documental completa por expediente
CREATE TABLE IF NOT EXISTS public.expediente_checklist_validacion (
  expediente_id uuid PRIMARY KEY,
  validada_at timestamptz NOT NULL DEFAULT now(),
  validada_por uuid,
  validada_por_nombre text,
  total_obligatorios integer NOT NULL,
  notas text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_checklist_validacion TO authenticated;
GRANT ALL ON public.expediente_checklist_validacion TO service_role;

ALTER TABLE public.expediente_checklist_validacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist validacion select" ON public.expediente_checklist_validacion
  FOR SELECT TO authenticated
  USING (can_use_checklist_docs(auth.uid()));

CREATE POLICY "checklist validacion upsert" ON public.expediente_checklist_validacion
  FOR INSERT TO authenticated
  WITH CHECK (can_use_checklist_docs(auth.uid()));

CREATE POLICY "checklist validacion update" ON public.expediente_checklist_validacion
  FOR UPDATE TO authenticated
  USING (can_use_checklist_docs(auth.uid()));

CREATE POLICY "checklist validacion delete" ON public.expediente_checklist_validacion
  FOR DELETE TO authenticated
  USING (can_use_checklist_docs(auth.uid()));