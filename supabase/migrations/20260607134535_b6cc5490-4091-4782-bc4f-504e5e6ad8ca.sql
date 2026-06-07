-- Conectar el recálculo automático del nivel de autonomía cuando se registren
-- auditorías o respuestas del banco
DROP TRIGGER IF EXISTS trg_recalc_autonomia_audit ON public.audit_simulaciones;
CREATE TRIGGER trg_recalc_autonomia_audit
AFTER INSERT OR UPDATE ON public.audit_simulaciones
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_nivel_autonomia();

DROP TRIGGER IF EXISTS trg_recalc_autonomia_banco ON public.audit_respuestas_banco;
CREATE TRIGGER trg_recalc_autonomia_banco
AFTER INSERT OR UPDATE ON public.audit_respuestas_banco
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_nivel_autonomia();

-- Backfill: recalcular para todos los analistas con datos previos
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT analista_id FROM public.audit_simulaciones WHERE analista_id IS NOT NULL
    UNION
    SELECT DISTINCT analista_id FROM public.audit_respuestas_banco WHERE analista_id IS NOT NULL
  ) LOOP
    PERFORM public.recalcular_nivel_autonomia(r.analista_id);
  END LOOP;
END $$;