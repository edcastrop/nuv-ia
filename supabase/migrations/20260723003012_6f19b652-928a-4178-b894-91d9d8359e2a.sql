-- ============================================================================
-- Reparación del avance del expediente NUV_2026_GH_000014 y centralización
-- atómica de la transición a "enviado a contratación" en el servidor.
--
-- Diseño:
--   * La clasificación de "etapa posterior" vive SIEMPRE en TypeScript (helpers
--     del Pipeline). Esta SQL no decide etapas.
--   * La RPC aplica guarda optimista con el estado que el server-fn leyó y
--     validó (parámetro p_estado_caso_esperado). Si el estado real bajo lock
--     no coincide, devuelve 'estado_cambio_concurrente' SIN tocar la fila.
--   * El INSERT en `expediente_historial` sólo ocurre cuando el UPDATE
--     efectivamente modificó una fila (ROW_COUNT = 1).
--   * `p_origen` es un enum controlado (nunca provisto por el cliente) y
--     determina `accion_origen` + texto de `observacion`.
-- ============================================================================

-- 1) Enum controlado de origen de la transición (uso interno).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'contratacion_origen_transicion'
  ) THEN
    CREATE TYPE public.contratacion_origen_transicion AS ENUM (
      'operativo_envio',
      'repair_migration'
    );
  END IF;
END$$;

-- 2) RPC atómica con guarda optimista.
CREATE OR REPLACE FUNCTION public.avanzar_expediente_a_enviado_contratacion(
  p_expediente_id        uuid,
  p_user_id              uuid,
  p_estado_caso_esperado public.caso_estado,
  p_origen               public.contratacion_origen_transicion
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_caso_actual public.caso_estado;
  v_codigo             text;
  v_row_count          int;
  v_accion             text;
  v_observacion        text;
BEGIN
  -- Guardas de invariantes de entrada.
  IF p_origen = 'operativo_envio' AND p_user_id IS NULL THEN
    RAISE EXCEPTION
      'avanzar_expediente_a_enviado_contratacion: p_user_id es obligatorio cuando p_origen = operativo_envio';
  END IF;

  -- Bloqueo pesimista del expediente + lectura del estado real bajo lock.
  SELECT estado_caso, codigo
    INTO v_estado_caso_actual, v_codigo
  FROM public.expedientes
  WHERE id = p_expediente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'avanzar_expediente_a_enviado_contratacion: expediente % no encontrado',
      p_expediente_id;
  END IF;

  -- Idempotencia: ya alineado al objetivo.
  IF v_estado_caso_actual IS NOT DISTINCT FROM 'enviado_contratacion'::public.caso_estado THEN
    RETURN 'ya_actualizado';
  END IF;

  -- Guarda optimista: el estado real debe coincidir EXACTAMENTE con el que
  -- TypeScript leyó y clasificó como transicionable.
  IF v_estado_caso_actual IS DISTINCT FROM p_estado_caso_esperado THEN
    RETURN 'estado_cambio_concurrente';
  END IF;

  -- Actualización atómica preservando la guarda en el WHERE.
  UPDATE public.expedientes
     SET estado      = 'ENVIADO_CONTRATACION'::public.expediente_estado,
         estado_caso = 'enviado_contratacion'::public.caso_estado,
         updated_at  = now()
   WHERE id = p_expediente_id
     AND estado_caso IS NOT DISTINCT FROM p_estado_caso_esperado
     AND (
       estado      IS DISTINCT FROM 'ENVIADO_CONTRATACION'::public.expediente_estado
       OR estado_caso IS DISTINCT FROM 'enviado_contratacion'::public.caso_estado
     );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  -- Idempotencia estructural: si el UPDATE no modificó ninguna fila, NO
  -- insertamos historial. Bajo el lock esto sólo puede pasar por un cambio
  -- concurrente entre la validación y el UPDATE (defensa en profundidad).
  IF v_row_count <> 1 THEN
    RETURN 'estado_cambio_concurrente';
  END IF;

  -- Mapeo controlado por origen (nunca por texto libre).
  IF p_origen = 'repair_migration' THEN
    v_accion      := 'repair_migration';
    v_observacion := 'Reparación técnica de estado_caso para ' || COALESCE(v_codigo, p_expediente_id::text);
  ELSE
    v_accion      := 'contratacion.enviar';
    v_observacion := 'Transición atómica servidor: envío a contratación';
  END IF;

  INSERT INTO public.expediente_historial (
    expediente_id, user_id,
    estado_caso_anterior, estado_caso_nuevo,
    accion_origen, observacion
  ) VALUES (
    p_expediente_id, p_user_id,
    p_estado_caso_esperado, 'enviado_contratacion'::public.caso_estado,
    v_accion, v_observacion
  );

  RETURN 'actualizado';
END;
$$;

-- 3) Grants: sólo el rol de servicio puede invocar la RPC. Los usuarios
--    autenticados/anon no tienen ejecución directa.
REVOKE ALL ON FUNCTION public.avanzar_expediente_a_enviado_contratacion(
  uuid, uuid, public.caso_estado, public.contratacion_origen_transicion
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.avanzar_expediente_a_enviado_contratacion(
  uuid, uuid, public.caso_estado, public.contratacion_origen_transicion
) TO service_role;

-- ============================================================================
-- 4) Reparación específica de NUV_2026_GH_000014.
--
-- Reglas estrictas bajo SELECT ... FOR UPDATE:
--   (a) estado_caso = 'enviado_contratacion'                  → no-op idempotente.
--   (b) estado = 'ENVIADO_CONTRATACION'
--       AND estado_caso = 'lead_creado'
--       AND existe al menos un envío con estado_envio='enviado' → reparar vía RPC.
--   (c) cualquier otra combinación                             → RAISE EXCEPTION.
--
-- No clasifica "etapa posterior" en SQL: si el caso ya avanzó a otro estado
-- distinto de lead_creado, aborta sin retrocederlo ni sobrescribirlo.
-- ============================================================================
DO $$
DECLARE
  v_expediente_id uuid;
  v_estado        public.expediente_estado;
  v_estado_caso   public.caso_estado;
  v_envio_ok      boolean;
  v_result        text;
BEGIN
  SELECT id, estado, estado_caso
    INTO v_expediente_id, v_estado, v_estado_caso
  FROM public.expedientes
  WHERE codigo = 'NUV_2026_GH_000014'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'repair_migration: expediente NUV_2026_GH_000014 no encontrado';
  END IF;

  -- Regla (a): alineado ⇒ no-op.
  IF v_estado_caso IS NOT DISTINCT FROM 'enviado_contratacion'::public.caso_estado THEN
    RAISE NOTICE 'repair_migration: NUV_2026_GH_000014 ya alineado (estado_caso=enviado_contratacion), no-op';
    RETURN;
  END IF;

  -- Regla (b): condiciones exactas documentadas.
  SELECT EXISTS (
    SELECT 1
    FROM public.envios_contratacion
    WHERE expediente_id = v_expediente_id
      AND estado_envio = 'enviado'
  ) INTO v_envio_ok;

  IF v_estado IS NOT DISTINCT FROM 'ENVIADO_CONTRATACION'::public.expediente_estado
     AND v_estado_caso IS NOT DISTINCT FROM 'lead_creado'::public.caso_estado
     AND v_envio_ok
  THEN
    v_result := public.avanzar_expediente_a_enviado_contratacion(
      p_expediente_id        => v_expediente_id,
      p_user_id              => NULL,
      p_estado_caso_esperado => 'lead_creado'::public.caso_estado,
      p_origen               => 'repair_migration'::public.contratacion_origen_transicion
    );

    IF v_result <> 'actualizado' THEN
      RAISE EXCEPTION
        'repair_migration: resultado inesperado de RPC para NUV_2026_GH_000014: %',
        v_result;
    END IF;

    RAISE NOTICE 'repair_migration: NUV_2026_GH_000014 reparado correctamente';
    RETURN;
  END IF;

  -- Regla (c): cualquier otra combinación aborta sin tocar el expediente.
  RAISE EXCEPTION
    'repair_migration: estado inesperado para NUV_2026_GH_000014 (estado=%, estado_caso=%, envio_ok=%). Aborta sin modificar.',
    v_estado, v_estado_caso, v_envio_ok;
END$$;
