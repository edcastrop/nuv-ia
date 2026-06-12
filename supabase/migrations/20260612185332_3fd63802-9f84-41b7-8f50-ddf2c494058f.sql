
-- Fase 4: integración automática QA AI

ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS auto_ejecutada boolean NOT NULL DEFAULT false;

ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS qa_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS qa_dictamen public.qa_dictamen,
  ADD COLUMN IF NOT EXISTS qa_categoria public.qa_categoria,
  ADD COLUMN IF NOT EXISTS qa_auditoria_id uuid REFERENCES public.qa_auditorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qa_ejecutada_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_expedientes_qa_categoria ON public.expedientes(qa_categoria);

-- Trigger: sincronizar columnas denormalizadas en expedientes
CREATE OR REPLACE FUNCTION public.qa_sync_expediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expediente_id IS NOT NULL THEN
    UPDATE public.expedientes
       SET qa_score = NEW.qa_score,
           qa_dictamen = NEW.dictamen,
           qa_categoria = NEW.categoria,
           qa_auditoria_id = NEW.id,
           qa_ejecutada_at = NEW.ejecutado_at
     WHERE id = NEW.expediente_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_sync_expediente ON public.qa_auditorias;
CREATE TRIGGER trg_qa_sync_expediente
  AFTER INSERT OR UPDATE OF qa_score, categoria, dictamen ON public.qa_auditorias
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_sync_expediente();

-- Función guard
CREATE OR REPLACE FUNCTION public.qa_bloquea_avance(_expediente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT qa_categoria FROM public.expedientes WHERE id = _expediente_id) = 'rechazado'::public.qa_categoria,
    false
  );
$$;

-- Política INSERT más amplia: el asesor del expediente también puede crear auditorías (auto-ejecución)
DROP POLICY IF EXISTS qa_auditorias_write ON public.qa_auditorias;
CREATE POLICY qa_auditorias_write_admin ON public.qa_auditorias
  FOR ALL TO authenticated
  USING (public.can_use_qa_ai(auth.uid()))
  WITH CHECK (public.can_use_qa_ai(auth.uid()));

CREATE POLICY qa_auditorias_insert_owner ON public.qa_auditorias
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = ejecutado_by
    AND expediente_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_id AND e.asesor_id = auth.uid()
    )
  );

-- Inconsistencias y alertas: permitir insert al dueño de la auditoría
DROP POLICY IF EXISTS qa_inconsistencias_insert_owner ON public.qa_inconsistencias;
CREATE POLICY qa_inconsistencias_insert_owner ON public.qa_inconsistencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = auditoria_id
        AND (public.can_use_qa_ai(auth.uid()) OR a.ejecutado_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS qa_alertas_insert_owner ON public.qa_alertas;
CREATE POLICY qa_alertas_insert_owner ON public.qa_alertas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = auditoria_id
        AND (public.can_use_qa_ai(auth.uid()) OR a.ejecutado_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS qa_log_insert_owner ON public.qa_auditoria_log;
CREATE POLICY qa_log_insert_owner ON public.qa_auditoria_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = auditoria_id
        AND (public.can_use_qa_ai(auth.uid()) OR a.ejecutado_by = auth.uid())
    )
  );
