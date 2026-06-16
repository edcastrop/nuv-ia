
-- ITER 5 · Endurecimiento RLS con roles válidos del enum app_role
-- Valid: admin, asesor, gerencia, licenciado, super_admin, juridica, operaciones,
--        cartera, contabilidad, director_financiero_qa, director_juridico,
--        auxiliar_operativo, apoderado

-- 1. user_roles
DROP POLICY IF EXISTS "Authenticated read all roles" ON public.user_roles;
CREATE POLICY "Users read own roles or admin reads all"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
  );

-- 2. clientes (PII)
DROP POLICY IF EXISTS "clientes_select_authenticated" ON public.clientes;
CREATE POLICY "clientes_select_authorized"
  ON public.clientes FOR SELECT TO authenticated
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
    OR public.has_role(auth.uid(), 'auxiliar_operativo'::app_role)
  );

-- 3. apoderados_nuvex (PII)
DROP POLICY IF EXISTS "Apoderados visibles para autenticados" ON public.apoderados_nuvex;
CREATE POLICY "Apoderados visibles por roles autorizados"
  ON public.apoderados_nuvex FOR SELECT TO authenticated
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
  );

-- 4. Operativas con expediente_id → can_access_expediente

DROP POLICY IF EXISTS "auth read analisis capacidad" ON public.analisis_capacidad_pago;
DROP POLICY IF EXISTS "auth insert analisis capacidad" ON public.analisis_capacidad_pago;
DROP POLICY IF EXISTS "auth update analisis capacidad" ON public.analisis_capacidad_pago;
DROP POLICY IF EXISTS "auth delete analisis capacidad" ON public.analisis_capacidad_pago;
CREATE POLICY "acp_select_exp" ON public.analisis_capacidad_pago FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "acp_insert_exp" ON public.analisis_capacidad_pago FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "acp_update_exp" ON public.analisis_capacidad_pago FOR UPDATE TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "acp_delete_exp" ON public.analisis_capacidad_pago FOR DELETE TO authenticated
  USING (
    public.can_access_expediente(auth.uid(), expediente_id) AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gerencia'::app_role)
    )
  );

DROP POLICY IF EXISTS "auth read proyecciones" ON public.expediente_proyecciones;
DROP POLICY IF EXISTS "auth insert proyecciones" ON public.expediente_proyecciones;
DROP POLICY IF EXISTS "auth update proyecciones" ON public.expediente_proyecciones;
DROP POLICY IF EXISTS "auth delete proyecciones" ON public.expediente_proyecciones;
CREATE POLICY "ep_select_exp" ON public.expediente_proyecciones FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "ep_insert_exp" ON public.expediente_proyecciones FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "ep_update_exp" ON public.expediente_proyecciones FOR UPDATE TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "ep_delete_exp" ON public.expediente_proyecciones FOR DELETE TO authenticated
  USING (
    public.can_access_expediente(auth.uid(), expediente_id) AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gerencia'::app_role)
    )
  );

DROP POLICY IF EXISTS "banco_req_read_auth" ON public.banco_requerimientos;
DROP POLICY IF EXISTS "banco_req_write_auth" ON public.banco_requerimientos;
CREATE POLICY "banco_req_select_exp" ON public.banco_requerimientos FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "banco_req_write_exp" ON public.banco_requerimientos FOR ALL TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

DROP POLICY IF EXISTS "pago_conc_read_auth" ON public.pago_conciliacion;
DROP POLICY IF EXISTS "pago_conc_write_auth" ON public.pago_conciliacion;
CREATE POLICY "pago_conc_select_exp" ON public.pago_conciliacion FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "pago_conc_write_exp" ON public.pago_conciliacion FOR ALL TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

DROP POLICY IF EXISTS "eventos_read_auth" ON public.caso_eventos;
DROP POLICY IF EXISTS "eventos_insert_auth" ON public.caso_eventos;
CREATE POLICY "eventos_select_exp" ON public.caso_eventos FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "eventos_insert_exp" ON public.caso_eventos FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

-- 5. casos_referidos por roles operativos
DROP POLICY IF EXISTS "referidos_read_auth" ON public.casos_referidos;
DROP POLICY IF EXISTS "referidos_write_auth" ON public.casos_referidos;
CREATE POLICY "referidos_select_roles" ON public.casos_referidos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
    OR public.has_role(auth.uid(), 'operaciones'::app_role)
    OR public.has_role(auth.uid(), 'asesor'::app_role)
    OR public.has_role(auth.uid(), 'auxiliar_operativo'::app_role)
  );
CREATE POLICY "referidos_write_roles" ON public.casos_referidos FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
    OR public.has_role(auth.uid(), 'operaciones'::app_role)
    OR public.has_role(auth.uid(), 'asesor'::app_role)
    OR public.has_role(auth.uid(), 'auxiliar_operativo'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
    OR public.has_role(auth.uid(), 'operaciones'::app_role)
    OR public.has_role(auth.uid(), 'asesor'::app_role)
    OR public.has_role(auth.uid(), 'auxiliar_operativo'::app_role)
  );

-- 6. validacion_operativa
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='validacion_operativa'
      AND (qual='true' OR with_check='true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.validacion_operativa', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "vo_select_exp" ON public.validacion_operativa FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY "vo_write_exp" ON public.validacion_operativa FOR ALL TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));
