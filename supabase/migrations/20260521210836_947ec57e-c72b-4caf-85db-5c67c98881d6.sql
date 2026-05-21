-- Expedientes: gerencia ve y administra todo
DROP POLICY IF EXISTS "Asesor sees own expedientes" ON public.expedientes;
CREATE POLICY "Asesor sees own expedientes" ON public.expedientes
  FOR SELECT USING (
    auth.uid() = asesor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );

DROP POLICY IF EXISTS "Asesor updates own expedientes" ON public.expedientes;
CREATE POLICY "Asesor updates own expedientes" ON public.expedientes
  FOR UPDATE USING (
    auth.uid() = asesor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );

DROP POLICY IF EXISTS "Asesor deletes own expedientes" ON public.expedientes;
CREATE POLICY "Asesor deletes own expedientes" ON public.expedientes
  FOR DELETE USING (
    auth.uid() = asesor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );

-- Historial visible y editable por gerencia
DROP POLICY IF EXISTS "Historial visible si expediente visible" ON public.expediente_historial;
CREATE POLICY "Historial visible si expediente visible" ON public.expediente_historial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_historial.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'gerencia')
        )
    )
  );

DROP POLICY IF EXISTS "Historial insert por owner" ON public.expediente_historial;
CREATE POLICY "Historial insert por owner" ON public.expediente_historial
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_historial.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'gerencia')
        )
    )
  );

-- Profiles: gerencia y admin pueden ver todos los perfiles (para dashboard por asesor)
DROP POLICY IF EXISTS "Profiles viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );