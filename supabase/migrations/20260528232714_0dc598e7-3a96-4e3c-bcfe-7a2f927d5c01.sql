
CREATE POLICY "Contratacion sees expedientes para validar"
  ON public.expedientes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'juridica'::app_role)
    OR has_role(auth.uid(), 'director_juridico'::app_role)
    OR has_role(auth.uid(), 'operaciones'::app_role)
  );

CREATE POLICY "Contratacion updates expedientes para validar"
  ON public.expedientes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'juridica'::app_role)
    OR has_role(auth.uid(), 'director_juridico'::app_role)
    OR has_role(auth.uid(), 'operaciones'::app_role)
  );
