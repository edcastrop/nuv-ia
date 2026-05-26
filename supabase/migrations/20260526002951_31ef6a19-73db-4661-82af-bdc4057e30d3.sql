
-- =====================================================================
-- 2. HELPERS DE ROL
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_director_qa(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'director_financiero_qa'::app_role)
      OR public.has_role(_uid, 'super_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_director_juridico(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'director_juridico'::app_role)
      OR public.has_role(_uid, 'super_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_apoderado(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'apoderado'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_validar_proyeccion(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'super_admin'::app_role)
      OR public.has_role(_uid, 'director_financiero_qa'::app_role)
      OR public.has_role(_uid, 'gerencia'::app_role);
$$;

-- =====================================================================
-- 3. TABLA validaciones_qa
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.validaciones_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  solicitada_por uuid NOT NULL,
  solicitada_at timestamptz NOT NULL DEFAULT now(),
  validada_por uuid,
  validada_at timestamptz,
  resultado text CHECK (resultado IN ('aprobada','devuelta')),
  motivo text CHECK (motivo IN (
    'cuota_incorrecta','fresh_incorrecto','ocr_incorrecto',
    'honorarios_incorrectos','error_financiero','error_digitacion','otro'
  )),
  observacion text,
  tiempo_validacion_min integer,
  primera_revision boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validaciones_qa_exp ON public.validaciones_qa(expediente_id);
CREATE INDEX IF NOT EXISTS idx_validaciones_qa_resultado ON public.validaciones_qa(resultado);
CREATE INDEX IF NOT EXISTS idx_validaciones_qa_solicitada_at ON public.validaciones_qa(solicitada_at);

ALTER TABLE public.validaciones_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "QA select por owner o validadores"
  ON public.validaciones_qa FOR SELECT TO authenticated
  USING (
    public.can_validar_proyeccion(auth.uid())
    OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND e.asesor_id = auth.uid())
  );

CREATE POLICY "QA insert por owner"
  ON public.validaciones_qa FOR INSERT TO authenticated
  WITH CHECK (
    solicitada_por = auth.uid()
    AND EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND e.asesor_id = auth.uid())
  );

CREATE POLICY "QA update por validadores"
  ON public.validaciones_qa FOR UPDATE TO authenticated
  USING (public.can_validar_proyeccion(auth.uid()));

-- =====================================================================
-- 4. PERMISOS — catálogo y matriz
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.permisos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  accion text NOT NULL,
  descripcion text,
  UNIQUE (modulo, accion)
);

CREATE TABLE IF NOT EXISTS public.rol_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  modulo text NOT NULL,
  accion text NOT NULL,
  permitido boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (role, modulo, accion)
);

ALTER TABLE public.permisos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalogo select autenticados"
  ON public.permisos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catalogo manage super_admin"
  ON public.permisos_catalogo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "RolPerm select autenticados"
  ON public.rol_permisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "RolPerm manage super_admin"
  ON public.rol_permisos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _modulo text, _accion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.rol_permisos rp ON rp.role = ur.role
      WHERE ur.user_id = _uid
        AND rp.modulo = _modulo
        AND rp.accion = _accion
        AND rp.permitido = true
    );
$$;

-- Seed catálogo (módulos × acciones)
INSERT INTO public.permisos_catalogo (modulo, accion)
SELECT m, a FROM
  (VALUES ('casos'),('expedientes'),('simulador'),('juridico'),('cartera'),
          ('contabilidad'),('dashboard'),('apoderados'),('academia'),('configuracion')) AS mods(m)
CROSS JOIN
  (VALUES ('ver'),('crear'),('editar'),('aprobar'),('eliminar'),('exportar')) AS acts(a)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. AUDITORÍA GLOBAL
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.auditoria_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  rol_efectivo text,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id uuid,
  caso_id uuid,
  expediente_id uuid,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_global_created ON public.auditoria_global(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aud_global_user ON public.auditoria_global(user_id);
CREATE INDEX IF NOT EXISTS idx_aud_global_exp ON public.auditoria_global(expediente_id);

ALTER TABLE public.auditoria_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aud global select managers"
  ON public.auditoria_global FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role)
      OR public.has_role(auth.uid(),'gerencia'::app_role)
      OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Aud global insert auth"
  ON public.auditoria_global FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- 6. NOTIFICACIONES POR USUARIO
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notificaciones_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text,
  link text,
  severidad text NOT NULL DEFAULT 'media',
  leida boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notificaciones_usuario(user_id, leida, created_at DESC);

ALTER TABLE public.notificaciones_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notif select propio"
  ON public.notificaciones_usuario FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Notif update propio"
  ON public.notificaciones_usuario FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notif insert auth"
  ON public.notificaciones_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.notify_user(_uid uuid, _tipo text, _titulo text, _mensaje text, _link text, _sev text DEFAULT 'media', _meta jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid uuid;
BEGIN
  INSERT INTO public.notificaciones_usuario(user_id,tipo,titulo,mensaje,link,severidad,metadata)
  VALUES (_uid,_tipo,_titulo,_mensaje,_link,_sev,_meta) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _tipo text, _titulo text, _mensaje text, _link text, _sev text DEFAULT 'media', _meta jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer := 0; r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = _role LOOP
    PERFORM public.notify_user(r.user_id,_tipo,_titulo,_mensaje,_link,_sev,_meta);
    c := c + 1;
  END LOOP;
  RETURN c;
END $$;

-- =====================================================================
-- 7. ACTUALIZAR map_caso_to_expediente_estado
-- =====================================================================

CREATE OR REPLACE FUNCTION public.map_caso_to_expediente_estado(_caso caso_estado)
RETURNS expediente_estado LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _caso
    WHEN 'lead_creado' THEN 'SIMULADO'::expediente_estado
    WHEN 'prospecto' THEN 'SIMULADO'::expediente_estado
    WHEN 'extracto_recibido' THEN 'SIMULADO'::expediente_estado
    WHEN 'simulacion_realizada' THEN 'SIMULADO'::expediente_estado
    WHEN 'simulado' THEN 'SIMULADO'::expediente_estado
    WHEN 'proyeccion_pendiente_qa' THEN 'SIMULADO'::expediente_estado
    WHEN 'proyeccion_aprobada_qa' THEN 'SIMULADO'::expediente_estado
    WHEN 'proyeccion_devuelta_qa' THEN 'SIMULADO'::expediente_estado
    WHEN 'propuesta_presentada' THEN 'SIMULADO'::expediente_estado
    WHEN 'propuesta_enviada' THEN 'SIMULADO'::expediente_estado
    WHEN 'acepto_propuesta' THEN 'SIMULADO'::expediente_estado
    WHEN 'negociacion' THEN 'SIMULADO'::expediente_estado
    WHEN 'pendiente_contratacion' THEN 'SIMULADO'::expediente_estado
    WHEN 'enviado_contratacion' THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_enviado' THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_generado' THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_firmado' THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_generado' THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_firmado' THEN 'FIRMADO'::expediente_estado
    WHEN 'documentacion_completa' THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_pendiente' THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_preparada' THEN 'FIRMADO'::expediente_estado
    WHEN 'radicado_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'en_estudio_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'docs_complementarios_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'devuelto_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'aprobado' THEN 'APROBADO'::expediente_estado
    WHEN 'aprobado_banco' THEN 'APROBADO'::expediente_estado
    WHEN 'documentos_banco_firmados' THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'condiciones_aplicadas' THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'aplicado_banco' THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'resultado_final_generado' THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'cuenta_cobro_generada' THEN 'FACTURADO'::expediente_estado
    WHEN 'cuenta_cobro_enviada' THEN 'FACTURADO'::expediente_estado
    WHEN 'honorarios_pendientes' THEN 'FACTURADO'::expediente_estado
    WHEN 'honorarios_pagados' THEN 'PAGADO'::expediente_estado
    WHEN 'paz_y_salvo_generado' THEN 'PAGADO'::expediente_estado
    WHEN 'caso_finalizado' THEN 'PAGADO'::expediente_estado
    WHEN 'negado_banco' THEN 'SIMULADO'::expediente_estado
    WHEN 'prejuridico' THEN 'FACTURADO'::expediente_estado
    WHEN 'proceso_cerrado' THEN 'SIMULADO'::expediente_estado
    ELSE 'SIMULADO'::expediente_estado
  END;
$$;

-- =====================================================================
-- 8. TRIGGERS: validaciones_qa
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trg_validacion_qa_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente text;
BEGIN
  SELECT cliente_nombre INTO v_cliente FROM public.expedientes WHERE id = NEW.expediente_id;
  PERFORM public.notify_role(
    'director_financiero_qa'::app_role,
    'qa_pendiente',
    'Nueva proyección pendiente de validación',
    'Cliente: ' || COALESCE(v_cliente,'—'),
    '/qa',
    'media',
    jsonb_build_object('expediente_id', NEW.expediente_id)
  );

  -- Cambiar estado del caso
  UPDATE public.expedientes
    SET estado_caso = 'proyeccion_pendiente_qa'::caso_estado
    WHERE id = NEW.expediente_id;

  INSERT INTO public.auditoria_global(user_id,accion,entidad,entidad_id,expediente_id,valor_nuevo)
  VALUES (NEW.solicitada_por,'qa_solicitada','validacion_qa',NEW.id,NEW.expediente_id,
          jsonb_build_object('solicitada_at',NEW.solicitada_at));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validacion_qa_insert ON public.validaciones_qa;
CREATE TRIGGER validacion_qa_insert AFTER INSERT ON public.validaciones_qa
  FOR EACH ROW EXECUTE FUNCTION public.trg_validacion_qa_insert();

CREATE OR REPLACE FUNCTION public.trg_validacion_qa_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estado caso_estado; v_asesor uuid; v_cliente text; v_mins integer;
BEGIN
  IF NEW.resultado IS NULL OR OLD.resultado IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.resultado = 'aprobada' THEN
    v_estado := 'proyeccion_aprobada_qa'::caso_estado;
  ELSE
    v_estado := 'proyeccion_devuelta_qa'::caso_estado;
    IF NEW.motivo IS NULL OR COALESCE(btrim(NEW.observacion),'') = '' THEN
      RAISE EXCEPTION 'Motivo y observación son obligatorios al devolver';
    END IF;
  END IF;

  v_mins := GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(NEW.validada_at, now()) - NEW.solicitada_at))/60)::int;
  NEW.tiempo_validacion_min := v_mins;
  IF NEW.validada_at IS NULL THEN NEW.validada_at := now(); END IF;

  UPDATE public.expedientes SET estado_caso = v_estado WHERE id = NEW.expediente_id
    RETURNING asesor_id, cliente_nombre INTO v_asesor, v_cliente;

  IF v_asesor IS NOT NULL THEN
    PERFORM public.notify_user(
      v_asesor,
      'qa_' || NEW.resultado,
      CASE WHEN NEW.resultado='aprobada' THEN 'Proyección aprobada por QA' ELSE 'Proyección devuelta por QA' END,
      'Cliente: ' || COALESCE(v_cliente,'—') || COALESCE(' — '||NEW.observacion,''),
      '/casos/' || NEW.expediente_id::text,
      CASE WHEN NEW.resultado='devuelta' THEN 'alta' ELSE 'media' END,
      jsonb_build_object('expediente_id', NEW.expediente_id, 'motivo', NEW.motivo)
    );
  END IF;

  INSERT INTO public.auditoria_global(user_id,accion,entidad,entidad_id,expediente_id,valor_nuevo)
  VALUES (NEW.validada_por,'qa_'||NEW.resultado,'validacion_qa',NEW.id,NEW.expediente_id,
          jsonb_build_object('resultado',NEW.resultado,'motivo',NEW.motivo,'tiempo_min',v_mins));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validacion_qa_update ON public.validaciones_qa;
CREATE TRIGGER validacion_qa_update BEFORE UPDATE ON public.validaciones_qa
  FOR EACH ROW EXECUTE FUNCTION public.trg_validacion_qa_update();

-- =====================================================================
-- 9. TRIGGER auditoría de cambios de estado en expedientes
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trg_aud_expediente_estado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.estado_caso IS DISTINCT FROM NEW.estado_caso
     OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.auditoria_global(user_id,accion,entidad,entidad_id,expediente_id,valor_anterior,valor_nuevo)
    VALUES (auth.uid(),'cambio_estado','expediente',NEW.id,NEW.id,
      jsonb_build_object('estado_caso',OLD.estado_caso,'estado',OLD.estado),
      jsonb_build_object('estado_caso',NEW.estado_caso,'estado',NEW.estado));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aud_expediente_estado ON public.expedientes;
CREATE TRIGGER aud_expediente_estado AFTER UPDATE OF estado_caso, estado ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_aud_expediente_estado();
