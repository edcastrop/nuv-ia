-- 1) RPC oficial — códigos de contrato alineados con la UI (ok / forbidden_role)
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
  _rol_analista BOOLEAN;
  _has_expediente BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
  END IF;

  _motivo_norm := btrim(regexp_replace(COALESCE(_motivo, ''), '\s+', ' ', 'g'));
  _motivo_len := char_length(_motivo_norm);
  IF _motivo_len < 3 OR _motivo_len > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_reason');
  END IF;

  SELECT id, analista_id, expediente_id, auditor_aprobado_at, estado_registro
    INTO _aud
    FROM public.qa_auditorias
    WHERE id = _auditoria_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF _aud.estado_registro = 'anulada' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_cancelled', 'idempotent', true);
  END IF;

  _rol_superior :=
       public.has_role(_uid, 'director_financiero_qa'::app_role)
    OR public.has_role(_uid, 'gerencia'::app_role)
    OR public.has_role(_uid, 'super_admin'::app_role);

  _rol_analista :=
       public.has_role(_uid, 'licenciado'::app_role)
    OR public.has_role(_uid, 'asesor'::app_role);

  _has_expediente := (_aud.expediente_id IS NOT NULL) OR EXISTS (
    SELECT 1 FROM public.expedientes WHERE qa_auditoria_id = _aud.id
  );
  IF _has_expediente THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked_to_expediente');
  END IF;

  IF NOT _rol_superior THEN
    IF _aud.analista_id IS DISTINCT FROM _uid THEN
      IF _rol_analista THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_owner');
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
    IF _aud.auditor_aprobado_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'approved_by_director');
    END IF;
  END IF;

  PERFORM set_config('nuvia.current_operation', 'qa_cancel', true);

  UPDATE public.qa_auditorias
     SET estado_registro = 'anulada',
         anulada_at = now(),
         anulada_by = _uid,
         motivo_anulacion = _motivo_norm
   WHERE id = _aud.id;

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
    'code', 'ok',
    'auditoria_id', _aud.id,
    'anulada_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anular_qa_auditoria(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anular_qa_auditoria(UUID, TEXT) TO authenticated;


-- 2) Gate de creación de expediente: la auditoría vinculada debe estar activa.
CREATE OR REPLACE FUNCTION public.validate_expediente_operativo_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  saldo_text text;
  cuota_text text;
  tasa_text text;
  v_requires_audit boolean;
  v_audit_ok boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    saldo_text := btrim(coalesce(NEW.credito_data->>'saldoCapital', NEW.credito_data->>'saldoPesos', ''));
    cuota_text := btrim(coalesce(NEW.credito_data->>'cuotaActual', NEW.credito_data->>'cuotaActualPesos', ''));
    tasa_text  := btrim(coalesce(NEW.credito_data->>'tea', NEW.credito_data->>'teaCobrada', ''));

    IF btrim(coalesce(NEW.cliente_nombre, '')) = '' OR lower(btrim(coalesce(NEW.cliente_nombre, ''))) = 'sin nombre' THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin nombre del cliente'
        USING ERRCODE = 'check_violation';
    END IF;
    IF btrim(coalesce(NEW.banco, '')) = '' THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin banco'
        USING ERRCODE = 'check_violation';
    END IF;
    IF btrim(coalesce(NEW.producto, '')) = '' THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin producto'
        USING ERRCODE = 'check_violation';
    END IF;
    IF saldo_text = '' OR nullif(regexp_replace(saldo_text, '[^0-9.,-]', '', 'g'), '') IS NULL THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin saldo capital'
        USING ERRCODE = 'check_violation';
    END IF;
    IF cuota_text = '' OR nullif(regexp_replace(cuota_text, '[^0-9.,-]', '', 'g'), '') IS NULL THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin cuota actual'
        USING ERRCODE = 'check_violation';
    END IF;
    IF tasa_text = '' OR nullif(regexp_replace(tasa_text, '[^0-9.,-]', '', 'g'), '') IS NULL THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin tasa del credito'
        USING ERRCODE = 'check_violation';
    END IF;

    v_requires_audit := public.has_role(NEW.asesor_id, 'licenciado'::public.app_role)
                     OR public.has_role(NEW.asesor_id, 'asesor'::public.app_role);

    IF v_requires_audit THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.qa_auditorias qa
        WHERE qa.id = NEW.qa_auditoria_id
          AND qa.analista_id = NEW.asesor_id
          AND qa.estado_registro = 'activa'
          AND (qa.expediente_id IS NULL OR qa.expediente_id = NEW.id)
          AND (
            (
              qa.dictamen IN ('aprobado', 'aprobado_obs')
              AND qa.categoria IN ('excelente', 'aprobado')
              AND coalesce(qa.qa_score, 0) >= 85
            )
            OR (
              qa.auditor_aprobado_at IS NOT NULL
              AND qa.auditor_aprobado_by IS NOT NULL
              AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = qa.auditor_aprobado_by)
            )
          )
      ) INTO v_audit_ok;

      IF NOT v_audit_ok THEN
        RAISE EXCEPTION 'NUVIA_QA_REQUERIDA: la auditoria vinculada no esta aprobada, esta anulada o no pertenece al analista'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- 3) Trigger simétrico: rechazar re-apuntar `expedientes.qa_auditoria_id`
--    a una auditoría anulada mediante UPDATE (INSERT ya lo cubre arriba).
CREATE OR REPLACE FUNCTION public.expedientes_guard_qa_anulada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _estado TEXT;
BEGIN
  IF NEW.qa_auditoria_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.qa_auditoria_id IS NOT DISTINCT FROM OLD.qa_auditoria_id THEN
    RETURN NEW;
  END IF;
  SELECT estado_registro INTO _estado
    FROM public.qa_auditorias
    WHERE id = NEW.qa_auditoria_id;
  IF _estado = 'anulada' THEN
    RAISE EXCEPTION 'NUVIA_QA_ANULADA: no se puede vincular un expediente a una auditoria anulada'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expedientes_guard_qa_anulada ON public.expedientes;
CREATE TRIGGER trg_expedientes_guard_qa_anulada
  BEFORE INSERT OR UPDATE OF qa_auditoria_id ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.expedientes_guard_qa_anulada();
