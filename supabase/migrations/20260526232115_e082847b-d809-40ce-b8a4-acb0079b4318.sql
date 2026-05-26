
CREATE OR REPLACE FUNCTION public.desvincular_usuario_sin_traslado(
  _target uuid,
  _motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_estado text;
  v_resumen jsonb;
  v_reglas int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'Usuario destino es obligatorio';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 10 THEN
    RAISE EXCEPTION 'El motivo es obligatorio (mínimo 10 caracteres)';
  END IF;

  SELECT estado_acceso::text INTO v_target_estado FROM public.profiles WHERE id = _target;
  IF v_target_estado IS NULL THEN
    RAISE EXCEPTION 'Usuario destino no existe';
  END IF;
  IF v_target_estado = 'desvinculado' THEN
    RAISE EXCEPTION 'El usuario ya fue desvinculado';
  END IF;

  -- Snapshot de huérfanos
  v_resumen := public.preview_desvinculacion(_target);

  -- Desactivar reglas de comisión a futuro
  UPDATE public.comisiones_reglas SET activo = false WHERE user_id = _target;
  GET DIAGNOSTICS v_reglas = ROW_COUNT;

  -- Revocar acceso
  DELETE FROM public.user_roles WHERE user_id = _target;

  -- Marcar perfil desvinculado SIN reemplazo
  UPDATE public.profiles
     SET estado_acceso = 'desvinculado'::public.acceso_estado,
         activo = false,
         desvinculado_at = now(),
         desvinculado_por = v_actor,
         reemplazo_user_id = NULL
   WHERE id = _target;

  -- Auditoría con conteo de huérfanos
  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (_target, v_actor, 'desvinculado_sin_traslado', jsonb_build_object(
    'motivo', _motivo,
    'reglas_desactivadas', v_reglas,
    'huerfanos', v_resumen
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'sin_traslado', true,
    'huerfanos', v_resumen
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.desvincular_usuario_sin_traslado(uuid, text) TO authenticated;
