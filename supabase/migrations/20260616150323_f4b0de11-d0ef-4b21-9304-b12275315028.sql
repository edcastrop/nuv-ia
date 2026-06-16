
-- academia_preguntas: re-grant column-level SELECT (excluyendo respuesta_correcta)
GRANT SELECT (id, evaluacion_id, enunciado, tipo, opciones, puntos, orden, created_at)
  ON public.academia_preguntas TO authenticated;
GRANT ALL ON public.academia_preguntas TO service_role;
-- super_admin lee respuesta_correcta vía policy ALL ya existente + grant completo
GRANT SELECT (respuesta_correcta), INSERT, UPDATE, DELETE
  ON public.academia_preguntas TO service_role;

-- documentos_juridicos_versiones: ownership en INSERT/UPDATE
DROP POLICY IF EXISTS "Docs versiones insert" ON public.documentos_juridicos_versiones;
DROP POLICY IF EXISTS "Docs versiones update obsoleto" ON public.documentos_juridicos_versiones;
CREATE POLICY "Docs versiones insert" ON public.documentos_juridicos_versiones
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "Docs versiones update obsoleto" ON public.documentos_juridicos_versiones
  FOR UPDATE TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

-- expediente_validacion_historial: ownership en INSERT
DROP POLICY IF EXISTS "Validacion hist insert" ON public.expediente_validacion_historial;
CREATE POLICY "Validacion hist insert" ON public.expediente_validacion_historial
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

-- honorarios_auditoria: solo creador del cálculo o aprobador
DROP POLICY IF EXISTS motor_audit_insert ON public.honorarios_auditoria;
CREATE POLICY motor_audit_insert ON public.honorarios_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_aprobar_honorarios(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.honorarios_calculos c
      WHERE c.id = honorarios_auditoria.calculo_id AND c.created_by = auth.uid()
    )
  );

-- cartera_auditoria: requiere acceso a la cartera referenciada
DROP POLICY IF EXISTS "Audit insert" ON public.cartera_auditoria;
CREATE POLICY "Audit insert" ON public.cartera_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cartera c
      WHERE c.id = cartera_auditoria.cartera_id
        AND public.can_view_cartera_row(auth.uid(), c.expediente_id)
    )
  );

-- cuentas_cobro_historial: solo dueño o roles de gestión
DROP POLICY IF EXISTS "CC hist insert" ON public.cuentas_cobro_historial;
CREATE POLICY "CC hist insert" ON public.cuentas_cobro_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cuentas_cobro c
      WHERE c.id = cuentas_cobro_historial.cuenta_cobro_id
        AND (
          c.user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'gerencia'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.has_role(auth.uid(), 'cartera'::app_role)
        )
    )
  );
