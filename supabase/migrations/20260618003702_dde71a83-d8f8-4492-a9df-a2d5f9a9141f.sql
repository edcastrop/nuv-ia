
-- 1) can_access_expediente: quitar licenciado del acceso global; solo accede si es asesor_id del expediente
CREATE OR REPLACE FUNCTION public.can_access_expediente(_uid uuid, _exp uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT has_role(_uid,'super_admin'::app_role)
      OR has_role(_uid,'admin'::app_role)
      OR has_role(_uid,'gerencia'::app_role)
      OR has_role(_uid,'director_financiero_qa'::app_role)
      OR has_role(_uid,'director_juridico'::app_role)
      OR has_role(_uid,'operaciones'::app_role)
      OR has_role(_uid,'juridica'::app_role)
      OR has_role(_uid,'contabilidad'::app_role)
      OR has_role(_uid,'cartera'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.expedientes e
        WHERE e.id = _exp AND e.asesor_id = _uid
      );
$function$;

-- 2) expedientes: quitar licenciado del bloque "Contratacion"
DROP POLICY IF EXISTS "Contratacion sees expedientes para validar" ON public.expedientes;
CREATE POLICY "Contratacion sees expedientes para validar"
ON public.expedientes
FOR SELECT
USING (
  has_role(auth.uid(), 'juridica'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
  OR has_role(auth.uid(), 'operaciones'::app_role)
);

DROP POLICY IF EXISTS "Contratacion updates expedientes para validar" ON public.expedientes;
CREATE POLICY "Contratacion updates expedientes para validar"
ON public.expedientes
FOR UPDATE
USING (
  has_role(auth.uid(), 'juridica'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
  OR has_role(auth.uid(), 'operaciones'::app_role)
);

-- 3) clientes: solo roles globales ven todo; asesor/licenciado/juridica/auxiliar solo ven clientes ligados a sus expedientes
DROP POLICY IF EXISTS "clientes_select_authorized" ON public.clientes;
CREATE POLICY "clientes_select_global_roles"
ON public.clientes
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR has_role(auth.uid(), 'operaciones'::app_role)
  OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
  OR has_role(auth.uid(), 'contabilidad'::app_role)
  OR has_role(auth.uid(), 'cartera'::app_role)
);

CREATE POLICY "clientes_select_own_caseload"
ON public.clientes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.asesor_id = auth.uid()
      AND (e.cliente_id = clientes.id OR e.cedula = clientes.cedula)
  )
);
