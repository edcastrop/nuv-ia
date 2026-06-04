
-- expediente_soportes (extractos del banco subidos al caso)
CREATE POLICY "DFQA select soportes"
  ON public.expediente_soportes FOR SELECT
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA insert soportes"
  ON public.expediente_soportes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA update soportes"
  ON public.expediente_soportes FOR UPDATE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA delete soportes"
  ON public.expediente_soportes FOR DELETE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

-- extractos_lecturas (parseo / lectura del extracto)
CREATE POLICY "DFQA select lecturas"
  ON public.extractos_lecturas FOR SELECT
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA insert lecturas"
  ON public.extractos_lecturas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA update lecturas"
  ON public.extractos_lecturas FOR UPDATE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA delete lecturas"
  ON public.extractos_lecturas FOR DELETE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

-- proyecciones_financieras (editar simulaciones enviadas por el analista)
CREATE POLICY "DFQA update proyecciones"
  ON public.proyecciones_financieras FOR UPDATE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "DFQA delete proyecciones"
  ON public.proyecciones_financieras FOR DELETE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

-- proyeccion_escenarios (editar / añadir escenarios de la simulación)
CREATE POLICY "DFQA update escenarios"
  ON public.proyeccion_escenarios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.proyecciones_financieras p
      WHERE p.id = proyeccion_escenarios.proyeccion_id
        AND has_role(auth.uid(), 'director_financiero_qa'::app_role)
    )
  );

CREATE POLICY "DFQA delete escenarios"
  ON public.proyeccion_escenarios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.proyecciones_financieras p
      WHERE p.id = proyeccion_escenarios.proyeccion_id
        AND has_role(auth.uid(), 'director_financiero_qa'::app_role)
    )
  );
