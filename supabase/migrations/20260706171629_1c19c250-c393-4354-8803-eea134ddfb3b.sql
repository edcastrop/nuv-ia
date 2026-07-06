CREATE OR REPLACE FUNCTION public.validate_expediente_operativo_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saldo_text text;
  cuota_text text;
  tasa_text text;
  v_is_analyst boolean;
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

    IF btrim(coalesce(NEW.cedula, '')) = '' THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin cedula del cliente'
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

    IF btrim(coalesce(NEW.numero_credito, '')) = '' THEN
      RAISE EXCEPTION 'NUVIA_CASO_INCOMPLETO: no se puede crear un caso operativo sin numero de credito'
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

    v_is_analyst := public.has_role(NEW.asesor_id, 'licenciado'::public.app_role)
                 OR public.has_role(NEW.asesor_id, 'analista_comercial'::public.app_role);

    IF v_is_analyst THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.qa_auditorias qa
        WHERE qa.id = NEW.qa_auditoria_id
          AND qa.analista_id = NEW.asesor_id
          AND qa.dictamen IN ('aprobado', 'aprobado_obs')
          AND qa.categoria IN ('excelente', 'aprobado')
          AND coalesce(qa.qa_score, 0) >= 85
      ) INTO v_audit_ok;

      IF NOT v_audit_ok THEN
        RAISE EXCEPTION 'NUVIA_QA_REQUERIDA: el analista/licenciado no puede crear un caso operativo sin una auditoria QA aprobada y vinculada'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_expediente_operativo_completo ON public.expedientes;
CREATE TRIGGER trg_validate_expediente_operativo_completo
BEFORE INSERT ON public.expedientes
FOR EACH ROW
EXECUTE FUNCTION public.validate_expediente_operativo_completo();