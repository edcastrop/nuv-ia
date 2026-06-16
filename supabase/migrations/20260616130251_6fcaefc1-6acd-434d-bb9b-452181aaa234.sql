
-- H7: Licenciado debe poder ver/actualizar expedientes para validar contratación
DROP POLICY IF EXISTS "Contratacion sees expedientes para validar" ON public.expedientes;
CREATE POLICY "Contratacion sees expedientes para validar"
ON public.expedientes FOR SELECT
USING (
  has_role(auth.uid(), 'juridica'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
  OR has_role(auth.uid(), 'operaciones'::app_role)
  OR has_role(auth.uid(), 'licenciado'::app_role)
);

DROP POLICY IF EXISTS "Contratacion updates expedientes para validar" ON public.expedientes;
CREATE POLICY "Contratacion updates expedientes para validar"
ON public.expedientes FOR UPDATE
USING (
  has_role(auth.uid(), 'juridica'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
  OR has_role(auth.uid(), 'operaciones'::app_role)
  OR has_role(auth.uid(), 'licenciado'::app_role)
);

-- H8: Contabilidad y cartera deben poder ver expedientes asociados a su cartera
CREATE POLICY "Contabilidad y cartera ven expedientes"
ON public.expedientes FOR SELECT
USING (
  has_role(auth.uid(), 'contabilidad'::app_role)
  OR has_role(auth.uid(), 'cartera'::app_role)
);

-- H9: Director Financiero QA debe poder aprobar honorarios
CREATE OR REPLACE FUNCTION public.can_aprobar_honorarios(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role)
      OR public.has_role(_uid,'director_financiero_qa'::app_role);
$function$;
