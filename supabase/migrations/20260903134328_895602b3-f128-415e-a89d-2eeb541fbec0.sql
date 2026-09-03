DROP POLICY IF EXISTS "Analista ve sus simulaciones" ON public.audit_simulaciones;

CREATE POLICY "Analista ve sus simulaciones"
ON public.audit_simulaciones
FOR SELECT
TO authenticated
USING (
  analista_id = auth.uid()
  OR (expediente_id IS NOT NULL AND public.es_responsable_expediente(auth.uid(), expediente_id))
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
);