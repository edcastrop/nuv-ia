-- Helper canónico: responsable del caso = creador (asesor_id) o analista asignado (licenciado_id)
CREATE OR REPLACE FUNCTION public.es_responsable_expediente(_uid uuid, _exp uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = _exp
      AND (e.asesor_id = _uid OR e.licenciado_id = _uid)
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_responsable_expediente(uuid, uuid) TO authenticated, service_role;

-- can_access_expediente pasa a reconocer también al analista asignado
CREATE OR REPLACE FUNCTION public.can_access_expediente(_uid uuid, _exp uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_uid,'super_admin'::app_role)
      OR has_role(_uid,'admin'::app_role)
      OR has_role(_uid,'gerencia'::app_role)
      OR has_role(_uid,'director_financiero_qa'::app_role)
      OR has_role(_uid,'director_juridico'::app_role)
      OR has_role(_uid,'operaciones'::app_role)
      OR has_role(_uid,'juridica'::app_role)
      OR has_role(_uid,'contabilidad'::app_role)
      OR has_role(_uid,'cartera'::app_role)
      OR public.es_responsable_expediente(_uid, _exp);
$$;

-- Expediente maestro (la simulación): id del maestro == id del expediente operativo
DROP POLICY IF EXISTS "Maestro select analista asignado" ON public.expediente_maestro;
CREATE POLICY "Maestro select analista asignado"
ON public.expediente_maestro FOR SELECT TO authenticated
USING (public.es_responsable_expediente(auth.uid(), expediente_maestro.id));

DROP POLICY IF EXISTS "Maestro update analista asignado" ON public.expediente_maestro;
CREATE POLICY "Maestro update analista asignado"
ON public.expediente_maestro FOR UPDATE TO authenticated
USING (public.es_responsable_expediente(auth.uid(), expediente_maestro.id))
WITH CHECK (public.es_responsable_expediente(auth.uid(), expediente_maestro.id));

-- Auditoría QA del caso
DROP POLICY IF EXISTS "qa_auditorias_select_analista_asignado" ON public.qa_auditorias;
CREATE POLICY "qa_auditorias_select_analista_asignado"
ON public.qa_auditorias FOR SELECT TO authenticated
USING (qa_auditorias.expediente_id IS NOT NULL
       AND public.es_responsable_expediente(auth.uid(), qa_auditorias.expediente_id));

DROP POLICY IF EXISTS "qa_inconsistencias_select_analista_asignado" ON public.qa_inconsistencias;
CREATE POLICY "qa_inconsistencias_select_analista_asignado"
ON public.qa_inconsistencias FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.qa_auditorias a
  WHERE a.id = qa_inconsistencias.auditoria_id
    AND a.expediente_id IS NOT NULL
    AND public.es_responsable_expediente(auth.uid(), a.expediente_id)
));

-- Cliente del caso
DROP POLICY IF EXISTS "clientes_select_analista_asignado" ON public.clientes;
CREATE POLICY "clientes_select_analista_asignado"
ON public.clientes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expedientes e
  WHERE e.licenciado_id = auth.uid()
    AND (e.cliente_id = clientes.id OR e.cedula = clientes.cedula)
));

-- Soportes y lecturas de extractos
DROP POLICY IF EXISTS "Soportes analista asignado" ON public.expediente_soportes;
CREATE POLICY "Soportes analista asignado"
ON public.expediente_soportes FOR ALL TO authenticated
USING (public.es_responsable_expediente(auth.uid(), expediente_soportes.expediente_id))
WITH CHECK (public.es_responsable_expediente(auth.uid(), expediente_soportes.expediente_id));

DROP POLICY IF EXISTS "Lecturas analista asignado" ON public.extractos_lecturas;
CREATE POLICY "Lecturas analista asignado"
ON public.extractos_lecturas FOR SELECT TO authenticated
USING (extractos_lecturas.expediente_id IS NOT NULL
       AND public.es_responsable_expediente(auth.uid(), extractos_lecturas.expediente_id));

-- Historial, alertas y submotivos del caso
DROP POLICY IF EXISTS "Historial select analista asignado" ON public.expediente_historial;
CREATE POLICY "Historial select analista asignado"
ON public.expediente_historial FOR SELECT TO authenticated
USING (public.es_responsable_expediente(auth.uid(), expediente_historial.expediente_id));

DROP POLICY IF EXISTS "Historial insert analista asignado" ON public.expediente_historial;
CREATE POLICY "Historial insert analista asignado"
ON public.expediente_historial FOR INSERT TO authenticated
WITH CHECK (public.es_responsable_expediente(auth.uid(), expediente_historial.expediente_id));

DROP POLICY IF EXISTS "Alertas select analista asignado" ON public.caso_alertas;
CREATE POLICY "Alertas select analista asignado"
ON public.caso_alertas FOR SELECT TO authenticated
USING (public.es_responsable_expediente(auth.uid(), caso_alertas.expediente_id));

DROP POLICY IF EXISTS "Submotivos select analista asignado" ON public.caso_submotivos;
CREATE POLICY "Submotivos select analista asignado"
ON public.caso_submotivos FOR SELECT TO authenticated
USING (public.es_responsable_expediente(auth.uid(), caso_submotivos.expediente_id));