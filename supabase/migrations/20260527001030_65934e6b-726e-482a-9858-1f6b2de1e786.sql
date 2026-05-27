
-- Tabla de solicitudes de reactivación
CREATE TABLE IF NOT EXISTS public.solicitudes_reactivacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  nombre text,
  correo text NOT NULL,
  rol_actual text,
  rol_solicitado text,
  motivo text,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
  aprobado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_aprobacion timestamptz,
  observacion_admin text,
  fecha_solicitud timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solr_user ON public.solicitudes_reactivacion(user_id);
CREATE INDEX IF NOT EXISTS idx_solr_correo ON public.solicitudes_reactivacion(lower(correo));
CREATE INDEX IF NOT EXISTS idx_solr_estado ON public.solicitudes_reactivacion(estado);

GRANT SELECT, INSERT, UPDATE ON public.solicitudes_reactivacion TO authenticated;
GRANT ALL ON public.solicitudes_reactivacion TO service_role;

ALTER TABLE public.solicitudes_reactivacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solr_super_admin_all" ON public.solicitudes_reactivacion
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "solr_owner_select" ON public.solicitudes_reactivacion
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_solr_updated_at
  BEFORE UPDATE ON public.solicitudes_reactivacion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC pública (anon) para solicitar reactivación durante el registro
CREATE OR REPLACE FUNCTION public.solicitar_reactivacion_por_email(
  _email text, _rol_solicitado text DEFAULT NULL, _motivo text DEFAULT NULL, _nombre text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prof record;
  v_rol_actual text;
  v_existing_pending uuid;
  v_solicitud_id uuid;
BEGIN
  IF _email IS NULL OR length(btrim(_email)) = 0 THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;

  SELECT id, nombre, email, estado_acceso::text AS estado
    INTO v_prof
    FROM public.profiles
    WHERE lower(email) = lower(btrim(_email))
    LIMIT 1;

  IF v_prof.id IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_prof.estado <> 'desvinculado' THEN
    RETURN jsonb_build_object('status','exists_not_desvinculado','estado', v_prof.estado);
  END IF;

  SELECT role::text INTO v_rol_actual FROM public.user_roles WHERE user_id = v_prof.id LIMIT 1;

  SELECT id INTO v_existing_pending
    FROM public.solicitudes_reactivacion
    WHERE user_id = v_prof.id AND estado = 'PENDIENTE'
    ORDER BY created_at DESC LIMIT 1;

  IF v_existing_pending IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_pending','solicitud_id', v_existing_pending);
  END IF;

  INSERT INTO public.solicitudes_reactivacion(user_id,nombre,correo,rol_actual,rol_solicitado,motivo,estado)
  VALUES (v_prof.id, COALESCE(_nombre, v_prof.nombre), v_prof.email, v_rol_actual, _rol_solicitado, _motivo, 'PENDIENTE')
  RETURNING id INTO v_solicitud_id;

  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (v_prof.id, v_prof.id, 'reactivacion_solicitada',
    jsonb_build_object('solicitud_id', v_solicitud_id, 'rol_solicitado', _rol_solicitado, 'motivo', _motivo));

  PERFORM public.notify_role(
    'super_admin'::app_role,
    'reactivacion_solicitada',
    'Nueva solicitud de reactivación',
    COALESCE(v_prof.nombre, v_prof.email) || ' solicita reactivar su cuenta.',
    '/super-admin/accesos',
    'alta',
    jsonb_build_object('solicitud_id', v_solicitud_id, 'user_id', v_prof.id)
  );

  RETURN jsonb_build_object('status','created','solicitud_id', v_solicitud_id);
END $$;

GRANT EXECUTE ON FUNCTION public.solicitar_reactivacion_por_email(text,text,text,text) TO anon, authenticated;

-- Aprobar reactivación
CREATE OR REPLACE FUNCTION public.reactivar_usuario_solicitud(
  _solicitud_id uuid, _nuevo_rol app_role DEFAULT NULL, _observacion text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sol record;
  v_rol_efectivo app_role;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_sol FROM public.solicitudes_reactivacion WHERE id = _solicitud_id;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'PENDIENTE' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;
  IF v_sol.user_id IS NULL THEN RAISE EXCEPTION 'Solicitud sin usuario asociado'; END IF;

  v_rol_efectivo := COALESCE(_nuevo_rol,
    NULLIF(v_sol.rol_solicitado,'')::app_role,
    NULLIF(v_sol.rol_actual,'')::app_role);

  -- Reactivar perfil conservando historial
  UPDATE public.profiles
    SET estado_acceso = 'aprobado'::public.acceso_estado,
        activo = true,
        desvinculado_at = NULL,
        desvinculado_por = NULL,
        reemplazo_user_id = NULL,
        aprobado_por = v_actor,
        aprobado_at = now()
    WHERE id = v_sol.user_id;

  -- Restaurar rol (limpiar previos y asignar el efectivo)
  IF v_rol_efectivo IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_sol.user_id;
    INSERT INTO public.user_roles(user_id, role) VALUES (v_sol.user_id, v_rol_efectivo)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.solicitudes_reactivacion
    SET estado = 'APROBADA',
        aprobado_por = v_actor,
        fecha_aprobacion = now(),
        observacion_admin = _observacion
    WHERE id = _solicitud_id;

  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (v_sol.user_id, v_actor, 'reactivado', jsonb_build_object(
    'solicitud_id', _solicitud_id,
    'rol_anterior', v_sol.rol_actual,
    'rol_nuevo', v_rol_efectivo::text,
    'observacion', _observacion
  ));

  PERFORM public.notify_user(
    v_sol.user_id, 'reactivacion_aprobada',
    'Tu cuenta NUVEX fue reactivada',
    'Ya puedes iniciar sesión nuevamente con tu correo y contraseña.',
    '/login', 'alta',
    jsonb_build_object('rol', v_rol_efectivo::text)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', v_sol.user_id, 'rol', v_rol_efectivo::text);
END $$;

GRANT EXECUTE ON FUNCTION public.reactivar_usuario_solicitud(uuid, app_role, text) TO authenticated;

-- Rechazar reactivación
CREATE OR REPLACE FUNCTION public.rechazar_reactivacion_solicitud(
  _solicitud_id uuid, _motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sol record;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo de rechazo obligatorio (mínimo 5 caracteres)';
  END IF;

  SELECT * INTO v_sol FROM public.solicitudes_reactivacion WHERE id = _solicitud_id;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'PENDIENTE' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;

  UPDATE public.solicitudes_reactivacion
    SET estado = 'RECHAZADA',
        aprobado_por = v_actor,
        fecha_aprobacion = now(),
        observacion_admin = _motivo
    WHERE id = _solicitud_id;

  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (v_sol.user_id, v_actor, 'reactivacion_rechazada',
    jsonb_build_object('solicitud_id', _solicitud_id, 'motivo', _motivo));

  IF v_sol.user_id IS NOT NULL THEN
    PERFORM public.notify_user(
      v_sol.user_id, 'reactivacion_rechazada',
      'Solicitud de reactivación rechazada',
      _motivo, '/login', 'media', jsonb_build_object('solicitud_id', _solicitud_id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.rechazar_reactivacion_solicitud(uuid, text) TO authenticated;

-- Backfill: generar solicitud para usuarios desvinculados sin solicitud pendiente
INSERT INTO public.solicitudes_reactivacion(user_id, nombre, correo, rol_actual, rol_solicitado, motivo, estado)
SELECT p.id, p.nombre, p.email,
       (SELECT role::text FROM public.user_roles WHERE user_id = p.id LIMIT 1),
       p.rol_solicitado,
       'Generada automáticamente — usuario desvinculado sin solicitud previa',
       'PENDIENTE'
FROM public.profiles p
WHERE p.estado_acceso::text = 'desvinculado'
  AND NOT EXISTS (
    SELECT 1 FROM public.solicitudes_reactivacion s
    WHERE s.user_id = p.id AND s.estado = 'PENDIENTE'
  );
