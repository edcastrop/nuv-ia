
-- Fase 1: campos para recálculo de honorarios a éxito
ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS cuotas_pactadas integer,
  ADD COLUMN IF NOT EXISTS cuotas_aprobadas_banco integer,
  ADD COLUMN IF NOT EXISTS honorarios_pactados numeric(14,2),
  ADD COLUMN IF NOT EXISTS honorarios_recalculados numeric(14,2),
  ADD COLUMN IF NOT EXISTS recalculo_user_id uuid,
  ADD COLUMN IF NOT EXISTS recalculo_at timestamptz;

-- Función de recálculo (regla de 3, no negativo, no cero si hubo éxito)
CREATE OR REPLACE FUNCTION public.aplicar_recalculo_honorarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pactadas integer;
  v_aprobadas integer;
  v_pactados numeric(14,2);
  v_recalc numeric(14,2);
BEGIN
  v_pactadas := COALESCE(NEW.cuotas_pactadas, 0);
  v_aprobadas := COALESCE(NEW.cuotas_aprobadas_banco, 0);
  v_pactados := COALESCE(NEW.honorarios_pactados, 0);

  IF v_pactadas > 0 AND v_pactados > 0 AND v_aprobadas > 0 THEN
    IF v_aprobadas = v_pactadas THEN
      v_recalc := v_pactados;
    ELSIF v_aprobadas < v_pactadas THEN
      v_recalc := ROUND(v_pactados / v_pactadas * v_aprobadas, 2);
    ELSE
      -- aprobadas > pactadas: mantener pactados (salvo override manual de super_admin)
      v_recalc := v_pactados;
    END IF;

    IF v_recalc < 0 THEN v_recalc := 0; END IF;

    NEW.honorarios_recalculados := v_recalc;
    -- Honorarios oficiales del expediente = recalculados (regla NUVEX)
    NEW.honorarios_final := v_recalc;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_honorarios ON public.expedientes;
CREATE TRIGGER trg_recalc_honorarios
  BEFORE INSERT OR UPDATE OF cuotas_pactadas, cuotas_aprobadas_banco, honorarios_pactados
  ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_recalculo_honorarios();

-- Auditoría del recálculo
CREATE OR REPLACE FUNCTION public.audit_recalculo_honorarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.honorarios_recalculados IS DISTINCT FROM NEW.honorarios_recalculados)
     OR (OLD.cuotas_aprobadas_banco IS DISTINCT FROM NEW.cuotas_aprobadas_banco) THEN
    INSERT INTO public.finanzas_auditoria
      (entidad, entidad_id, accion, user_id, valor_anterior, valor_nuevo)
    VALUES (
      'expediente', NEW.id, 'recalculo_honorarios', NEW.recalculo_user_id,
      jsonb_build_object(
        'cuotas_pactadas', OLD.cuotas_pactadas,
        'cuotas_aprobadas_banco', OLD.cuotas_aprobadas_banco,
        'honorarios_pactados', OLD.honorarios_pactados,
        'honorarios_recalculados', OLD.honorarios_recalculados,
        'honorarios_final', OLD.honorarios_final
      ),
      jsonb_build_object(
        'cuotas_pactadas', NEW.cuotas_pactadas,
        'cuotas_aprobadas_banco', NEW.cuotas_aprobadas_banco,
        'honorarios_pactados', NEW.honorarios_pactados,
        'honorarios_recalculados', NEW.honorarios_recalculados,
        'honorarios_final', NEW.honorarios_final
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_recalculo_honorarios ON public.expedientes;
CREATE TRIGGER trg_audit_recalculo_honorarios
  AFTER UPDATE OF cuotas_aprobadas_banco, honorarios_recalculados
  ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_recalculo_honorarios();
