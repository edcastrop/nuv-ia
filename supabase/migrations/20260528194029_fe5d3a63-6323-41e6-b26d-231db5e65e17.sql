
-- 1) Incluir contabilidad en gestión de cartera
CREATE OR REPLACE FUNCTION public.can_manage_cartera(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT has_role(_uid, 'super_admin') OR has_role(_uid, 'admin')
      OR has_role(_uid, 'gerencia')   OR has_role(_uid, 'cartera')
      OR has_role(_uid, 'contabilidad');
$function$;

-- 2) Cuentas de cobro: añadir contabilidad a select y update
DROP POLICY IF EXISTS "CC select propio o manager" ON public.cuentas_cobro;
CREATE POLICY "CC select propio o manager" ON public.cuentas_cobro
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'gerencia'::app_role)
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'cartera'::app_role)
  OR has_role(auth.uid(),'contabilidad'::app_role)
);

DROP POLICY IF EXISTS "CC update propio borrador" ON public.cuentas_cobro;
CREATE POLICY "CC update propio borrador" ON public.cuentas_cobro
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'gerencia'::app_role)
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'cartera'::app_role)
  OR has_role(auth.uid(),'contabilidad'::app_role)
);

-- 3) Comisiones: añadir contabilidad a select y manage
DROP POLICY IF EXISTS "Comisiones select propio o manager" ON public.comisiones;
CREATE POLICY "Comisiones select propio o manager" ON public.comisiones
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'gerencia'::app_role)
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'cartera'::app_role)
  OR has_role(auth.uid(),'contabilidad'::app_role)
);

DROP POLICY IF EXISTS "Comisiones manage admin" ON public.comisiones;
CREATE POLICY "Comisiones manage admin" ON public.comisiones
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'gerencia'::app_role)
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'contabilidad'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'gerencia'::app_role)
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'contabilidad'::app_role)
);
