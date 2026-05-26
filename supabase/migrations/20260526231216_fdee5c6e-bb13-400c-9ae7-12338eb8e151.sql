
-- 1. Nuevo estado de acceso "desvinculado"
ALTER TYPE public.acceso_estado ADD VALUE IF NOT EXISTS 'desvinculado';

-- 2. Columnas de trazabilidad en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desvinculado_at timestamptz,
  ADD COLUMN IF NOT EXISTS desvinculado_por uuid,
  ADD COLUMN IF NOT EXISTS reemplazo_user_id uuid;

-- 3. Función de PREVIEW: cuenta dependencias antes de desvincular
CREATE OR REPLACE FUNCTION public.preview_desvinculacion(_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp int; v_cart_resp int; v_cart_creator int;
  v_com_pend int; v_com_pag int; v_cc_pend int; v_cc_pag int;
  v_reglas int; v_val_pend int; v_val_hist int;
  v_msgs int; v_notif int; v_aud int; v_acad int;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT count(*) INTO v_exp FROM public.expedientes WHERE asesor_id = _target;
  SELECT count(*) INTO v_cart_resp FROM public.cartera WHERE responsable_id = _target;
  SELECT count(*) INTO v_cart_creator FROM public.cartera WHERE created_by = _target;
  SELECT count(*) INTO v_com_pend FROM public.comisiones
    WHERE user_id = _target AND COALESCE(estado::text,'generada') NOT IN ('pagada');
  SELECT count(*) INTO v_com_pag FROM public.comisiones
    WHERE user_id = _target AND estado::text = 'pagada';
  SELECT count(*) INTO v_cc_pend FROM public.cuentas_cobro
    WHERE user_id = _target AND COALESCE(estado::text,'borrador') NOT IN ('pagada');
  SELECT count(*) INTO v_cc_pag FROM public.cuentas_cobro
    WHERE user_id = _target AND estado::text = 'pagada';
  SELECT count(*) INTO v_reglas FROM public.comisiones_reglas WHERE user_id = _target;
  SELECT count(*) INTO v_val_pend FROM public.validaciones_qa
    WHERE (solicitada_por = _target OR validada_por = _target) AND validada_at IS NULL;
  SELECT count(*) INTO v_val_hist FROM public.validaciones_qa
    WHERE (solicitada_por = _target OR validada_por = _target) AND validada_at IS NOT NULL;
  SELECT count(*) INTO v_msgs FROM public.colab_mensajes WHERE user_id = _target;
  SELECT count(*) INTO v_notif FROM public.notificaciones_usuario WHERE user_id = _target;
  SELECT count(*) INTO v_aud FROM public.acceso_auditoria WHERE user_id = _target OR actor_id = _target;
  SELECT count(*) INTO v_acad FROM public.academia_progreso_lecciones WHERE user_id = _target;

  RETURN jsonb_build_object(
    'transferibles', jsonb_build_object(
      'expedientes', v_exp,
      'cartera_responsable', v_cart_resp,
      'cartera_creador', v_cart_creator,
      'reglas_comision', v_reglas,
      'validaciones_qa_pendientes', v_val_pend
    ),
    'comisiones', jsonb_build_object(
      'pendientes', v_com_pend,
      'pagadas', v_com_pag,
      'cuentas_cobro_pendientes', v_cc_pend,
      'cuentas_cobro_pagadas', v_cc_pag
    ),
    'historico', jsonb_build_object(
      'mensajes', v_msgs,
      'notificaciones', v_notif,
      'auditoria', v_aud,
      'progreso_academia', v_acad,
      'validaciones_qa_historicas', v_val_hist
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_desvinculacion(uuid) TO authenticated;

-- 4. Función principal: DESVINCULAR con transferencia obligatoria
CREATE OR REPLACE FUNCTION public.desvincular_usuario(
  _target uuid,
  _reemplazo uuid,
  _transferir_comisiones boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_estado text;
  v_reemplazo_estado text;
  v_resumen jsonb;
  v_exp int; v_cart_r int; v_cart_c int; v_reglas int;
  v_com int := 0; v_cc int := 0; v_val int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _target IS NULL OR _reemplazo IS NULL THEN
    RAISE EXCEPTION 'Usuario destino y reemplazo son obligatorios';
  END IF;
  IF _target = _reemplazo THEN
    RAISE EXCEPTION 'El reemplazo no puede ser el mismo usuario';
  END IF;

  SELECT estado_acceso::text INTO v_target_estado FROM public.profiles WHERE id = _target;
  IF v_target_estado IS NULL THEN
    RAISE EXCEPTION 'Usuario destino no existe';
  END IF;
  IF v_target_estado = 'desvinculado' THEN
    RAISE EXCEPTION 'El usuario ya fue desvinculado';
  END IF;

  SELECT estado_acceso::text INTO v_reemplazo_estado FROM public.profiles WHERE id = _reemplazo;
  IF v_reemplazo_estado IS NULL THEN
    RAISE EXCEPTION 'Usuario de reemplazo no existe';
  END IF;
  IF v_reemplazo_estado NOT IN ('aprobado') THEN
    RAISE EXCEPTION 'El usuario de reemplazo debe estar aprobado/activo';
  END IF;

  -- Capturar snapshot antes
  v_resumen := public.preview_desvinculacion(_target);

  -- Transferencias operativas (siempre)
  UPDATE public.expedientes SET asesor_id = _reemplazo WHERE asesor_id = _target;
  GET DIAGNOSTICS v_exp = ROW_COUNT;

  UPDATE public.cartera SET responsable_id = _reemplazo WHERE responsable_id = _target;
  GET DIAGNOSTICS v_cart_r = ROW_COUNT;

  UPDATE public.cartera SET created_by = _reemplazo WHERE created_by = _target;
  GET DIAGNOSTICS v_cart_c = ROW_COUNT;

  -- Validaciones QA pendientes: reasignar al reemplazo
  UPDATE public.validaciones_qa
     SET solicitada_por = _reemplazo
   WHERE solicitada_por = _target AND validada_at IS NULL;
  GET DIAGNOSTICS v_val = ROW_COUNT;

  -- Comisiones (opcional). Pendientes/no pagadas -> reemplazo. Pagadas se mantienen histórico.
  IF _transferir_comisiones THEN
    UPDATE public.comisiones
       SET user_id = _reemplazo
     WHERE user_id = _target
       AND COALESCE(estado::text,'generada') NOT IN ('pagada');
    GET DIAGNOSTICS v_com = ROW_COUNT;

    UPDATE public.cuentas_cobro
       SET user_id = _reemplazo
     WHERE user_id = _target
       AND COALESCE(estado::text,'borrador') NOT IN ('pagada');
    GET DIAGNOSTICS v_cc = ROW_COUNT;

    UPDATE public.comisiones_reglas SET user_id = _reemplazo WHERE user_id = _target;
    GET DIAGNOSTICS v_reglas = ROW_COUNT;
  ELSE
    -- Desactivar reglas del usuario saliente para que no apliquen a futuro
    UPDATE public.comisiones_reglas SET activo = false WHERE user_id = _target;
    GET DIAGNOSTICS v_reglas = ROW_COUNT;
  END IF;

  -- Revocar acceso: eliminar roles
  DELETE FROM public.user_roles WHERE user_id = _target;

  -- Marcar perfil desvinculado
  UPDATE public.profiles
     SET estado_acceso = 'desvinculado'::public.acceso_estado,
         activo = false,
         desvinculado_at = now(),
         desvinculado_por = v_actor,
         reemplazo_user_id = _reemplazo
   WHERE id = _target;

  -- Auditoría
  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (_target, v_actor, 'desvinculado', jsonb_build_object(
    'reemplazo_user_id', _reemplazo,
    'transferir_comisiones', _transferir_comisiones,
    'transferido', jsonb_build_object(
      'expedientes', v_exp,
      'cartera_responsable', v_cart_r,
      'cartera_creador', v_cart_c,
      'validaciones_qa_pendientes', v_val,
      'comisiones', v_com,
      'cuentas_cobro', v_cc,
      'reglas_comision', v_reglas
    ),
    'preview', v_resumen
  ));

  -- Notificar al reemplazo
  PERFORM public.notify_user(
    _reemplazo,
    'transferencia_recibida',
    'Has recibido casos transferidos',
    'Se te transfirieron ' || v_exp || ' expediente(s) por desvinculación de un colaborador.',
    '/casos',
    'alta',
    jsonb_build_object('expedientes', v_exp, 'origen_user_id', _target)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'transferido', jsonb_build_object(
      'expedientes', v_exp,
      'cartera_responsable', v_cart_r,
      'cartera_creador', v_cart_c,
      'validaciones_qa_pendientes', v_val,
      'comisiones', v_com,
      'cuentas_cobro', v_cc,
      'reglas_comision', v_reglas
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.desvincular_usuario(uuid, uuid, boolean) TO authenticated;
