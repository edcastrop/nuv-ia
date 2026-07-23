DROP POLICY IF EXISTS "Apoderados visibles por roles autorizados" ON public.apoderados_nuvex;

CREATE POLICY "Apoderados visibles por roles autorizados"
ON public.apoderados_nuvex
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerencia'::app_role)
  OR public.has_role(auth.uid(), 'operaciones'::app_role)
  OR public.has_role(auth.uid(), 'director_financiero_qa'::app_role)
  OR public.has_role(auth.uid(), 'director_juridico'::app_role)
  OR public.has_role(auth.uid(), 'juridica'::app_role)
  OR public.has_role(auth.uid(), 'licenciado'::app_role)
  OR public.has_role(auth.uid(), 'contabilidad'::app_role)
  OR public.has_role(auth.uid(), 'cartera'::app_role)
  OR public.has_role(auth.uid(), 'asesor'::app_role)
);