-- 1) Índice único parcial: idempotencia a nivel BD para evitar dos expedientes por auditoría.
-- Preflight ejecutado en la sesión: 0 duplicados en expedientes(qa_auditoria_id).
CREATE UNIQUE INDEX IF NOT EXISTS expedientes_qa_auditoria_id_unique
  ON public.expedientes (qa_auditoria_id)
  WHERE qa_auditoria_id IS NOT NULL;

-- 2) Ampliar el trigger para aceptar aprobación formal del Director (auditor_aprobado_at),
--    incluido el override manual con score < 85, sin dejar de exigir integridad completa:
--    la auditoría debe seguir siendo del mismo analista, no debe haber sido devuelta,
--    y (si aún es "aprobado_por_score" automático) mantiene el guardarraíl anterior.
CREATE OR REPLACE FUNCTION public.validate_expediente_operativo_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      -- Integridad completa de la auditoría vinculada:
      --   • pertenece al analista que crea el caso (NEW.asesor_id = qa.analista_id)
      --   • no fue devuelta al analista después
      --   • no está ya vinculada a OTRO expediente (excluye el mismo id por idempotencia)
      --   • cumple UNA de las dos vías de aprobación:
      --       (a) aprobación automática por score/dictamen/categoría (comportamiento previo)
      --       (b) aprobación formal del Director (auditor_aprobado_at IS NOT NULL) con auditor real
      SELECT EXISTS (
        SELECT 1
        FROM public.qa_auditorias qa
        WHERE qa.id = NEW.qa_auditoria_id
          AND qa.analista_id = NEW.asesor_id
          AND qa.devuelto_al_analista_at IS NULL
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
        RAISE EXCEPTION 'NUVIA_QA_REQUERIDA: la auditoría vinculada no está aprobada o no pertenece al analista'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;