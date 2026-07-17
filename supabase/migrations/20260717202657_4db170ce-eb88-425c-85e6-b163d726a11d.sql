-- 1) Columnas de anulación lógica
ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS estado_registro TEXT NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulada_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

ALTER TABLE public.qa_auditorias
  DROP CONSTRAINT IF EXISTS qa_auditorias_estado_registro_check;
ALTER TABLE public.qa_auditorias
  ADD CONSTRAINT qa_auditorias_estado_registro_check
  CHECK (estado_registro IN ('activa','anulada'));

-- 2) Índice parcial para bandejas operativas por analista
CREATE INDEX IF NOT EXISTS idx_qa_auditorias_activas_analista
  ON public.qa_auditorias (analista_id, ejecutado_at DESC)
  WHERE estado_registro = 'activa';

-- 3) Defensa A — REVOKE amplio + GRANT por columnas (whitelist)
REVOKE UPDATE, DELETE ON public.qa_auditorias FROM anon, authenticated;

-- Columnas explícitamente escribibles por `authenticated`.
-- Columnas NO otorgadas (solo modificables vía la RPC oficial):
--   estado_registro, anulada_at, anulada_by, motivo_anulacion,
--   expediente_id, devuelto_al_analista_at, devuelto_al_analista_by,
--   devolucion_notas, devolucion_ajustes, updated_at
GRANT UPDATE (
  motor_version, qa_score, categoria, dictamen,
  inputs, outputs, diferencias, alertas,
  ejecutado_at, ejecutado_by, auto_ejecutada,
  codigo, origen, banco, producto, cliente_nombre,
  simulacion_id, extracto_id, modalidad, analista_id,
  auditor_aprobado_at, auditor_aprobado_by, auditor_notas,
  auditor_validated_at, auditor_score_anterior,
  auditor_override, auditor_override_justificacion,
  notas_analista_al_auditor,
  simulador_snapshot, extracto_archivo
) ON public.qa_auditorias TO authenticated;

-- 4) Defensa B — trigger que impide UPDATEs directos a columnas protegidas
-- La frontera real es `current_user`: dentro de la RPC SECURITY DEFINER
-- current_user es el propietario (postgres); en una llamada directa desde
-- PostgREST/authenticated permanece como 'authenticated'. El GUC
-- `nuvia.current_operation` se usa como firma de consistencia (no como
-- frontera de seguridad, ya que un usuario puede falsificarlo con set_config).
CREATE OR REPLACE FUNCTION public.qa_auditorias_guard_anulacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _op TEXT;
BEGIN
  IF NEW.estado_registro IS DISTINCT FROM OLD.estado_registro
     OR NEW.anulada_at IS DISTINCT FROM OLD.anulada_at
     OR NEW.anulada_by IS DISTINCT FROM OLD.anulada_by
     OR NEW.motivo_anulacion IS DISTINCT FROM OLD.motivo_anulacion THEN

    _op := current_setting('nuvia.current_operation', true);

    IF current_user NOT IN ('postgres','supabase_admin','service_role')
       OR _op IS DISTINCT FROM 'qa_cancel' THEN
      RAISE EXCEPTION 'Modificación directa de columnas de anulación no permitida'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_auditorias_guard_anulacion ON public.qa_auditorias;
CREATE TRIGGER trg_qa_auditorias_guard_anulacion
  BEFORE UPDATE ON public.qa_auditorias
  FOR EACH ROW EXECUTE FUNCTION public.qa_auditorias_guard_anulacion();

-- 5) RPC oficial de anulación lógica — SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.anular_qa_auditoria(
  _auditoria_id UUID,
  _motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _aud RECORD;
  _motivo_norm TEXT;
  _motivo_len INT;
  _rol_superior BOOLEAN;
  _has_expediente BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  -- Normalización y validación del motivo (idéntica en las 3 capas)
  _motivo_norm := btrim(regexp_replace(COALESCE(_motivo, ''), '\s+', ' ', 'g'));
  _motivo_len := char_length(_motivo_norm);
  IF _motivo_len < 3 OR _motivo_len > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_reason');
  END IF;

  -- Lock exclusivo de la fila mientras dura la transacción
  SELECT id, analista_id, expediente_id, auditor_aprobado_at, estado_registro
    INTO _aud
    FROM public.qa_auditorias
    WHERE id = _auditoria_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Idempotencia
  IF _aud.estado_registro = 'anulada' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_cancelled', 'idempotent', true);
  END IF;

  _rol_superior :=
       public.has_role(_uid, 'director_financiero_qa'::app_role)
    OR public.has_role(_uid, 'gerencia'::app_role)
    OR public.has_role(_uid, 'super_admin'::app_role);

  -- Vínculo con expediente bloquea a TODOS los roles
  _has_expediente := (_aud.expediente_id IS NOT NULL) OR EXISTS (
    SELECT 1 FROM public.expedientes WHERE qa_auditoria_id = _aud.id
  );
  IF _has_expediente THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked_to_expediente');
  END IF;

  -- Reglas por rol
  IF NOT _rol_superior THEN
    IF _aud.analista_id IS DISTINCT FROM _uid THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_owner');
    END IF;
    IF _aud.auditor_aprobado_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'approved_by_director');
    END IF;
  END IF;

  -- Marca de consistencia para el trigger + UPDATE atómico
  PERFORM set_config('nuvia.current_operation', 'qa_cancel', true);

  UPDATE public.qa_auditorias
     SET estado_registro = 'anulada',
         anulada_at = now(),
         anulada_by = _uid,
         motivo_anulacion = _motivo_norm
   WHERE id = _aud.id;

  -- Log best-effort (no debe abortar la anulación si falla)
  BEGIN
    INSERT INTO public.qa_auditoria_log (auditoria_id, accion, payload, user_id)
    VALUES (
      _aud.id,
      'anular',
      jsonb_build_object('motivo', _motivo_norm, 'rol_superior', _rol_superior),
      _uid
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'cancelled',
    'auditoria_id', _aud.id,
    'anulada_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anular_qa_auditoria(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anular_qa_auditoria(UUID, TEXT) TO authenticated;

-- 6) Filas existentes: el DEFAULT ya deja `estado_registro='activa'`. Nada que migrar.