
-- 1. INSERT en qa_auditorias: permitir origen='simulador_escalado' sin expediente,
--    siempre que el analista se esté auto-registrando como ejecutor y analista.
DROP POLICY IF EXISTS qa_auditorias_insert_escalada ON public.qa_auditorias;
CREATE POLICY qa_auditorias_insert_escalada ON public.qa_auditorias
  FOR INSERT TO authenticated
  WITH CHECK (
    origen = 'simulador_escalado'
    AND ejecutado_by = auth.uid()
    AND (analista_id IS NULL OR analista_id = auth.uid())
    AND expediente_id IS NULL
  );

-- 2. SELECT en qa_auditorias: el analista puede ver su propia auditoría escalada
DROP POLICY IF EXISTS qa_auditorias_select_owner_escalada ON public.qa_auditorias;
CREATE POLICY qa_auditorias_select_owner_escalada ON public.qa_auditorias
  FOR SELECT TO authenticated
  USING (
    origen = 'simulador_escalado'
    AND (analista_id = auth.uid() OR ejecutado_by = auth.uid())
  );

-- 3. SELECT en qa_inconsistencias para auditorías escaladas del propio analista
DROP POLICY IF EXISTS qa_inconsistencias_select_owner_escalada ON public.qa_inconsistencias;
CREATE POLICY qa_inconsistencias_select_owner_escalada ON public.qa_inconsistencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = qa_inconsistencias.auditoria_id
        AND a.origen = 'simulador_escalado'
        AND (a.analista_id = auth.uid() OR a.ejecutado_by = auth.uid())
    )
  );

-- 4. SELECT en qa_alertas para auditorías escaladas del propio analista
DROP POLICY IF EXISTS qa_alertas_select_owner_escalada ON public.qa_alertas;
CREATE POLICY qa_alertas_select_owner_escalada ON public.qa_alertas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = qa_alertas.auditoria_id
        AND a.origen = 'simulador_escalado'
        AND (a.analista_id = auth.uid() OR a.ejecutado_by = auth.uid())
    )
  );

-- 5. SELECT en qa_auditoria_log para auditorías escaladas del propio analista
DROP POLICY IF EXISTS qa_log_select_owner_escalada ON public.qa_auditoria_log;
CREATE POLICY qa_log_select_owner_escalada ON public.qa_auditoria_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_auditorias a
      WHERE a.id = qa_auditoria_log.auditoria_id
        AND a.origen = 'simulador_escalado'
        AND (a.analista_id = auth.uid() OR a.ejecutado_by = auth.uid())
    )
  );
