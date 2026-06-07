
-- RPC: recalcular nivel autonomía a partir de simulaciones y respuestas banco
CREATE OR REPLACE FUNCTION public.recalcular_nivel_autonomia(_user_id uuid)
RETURNS public.analista_metricas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_score numeric(5,2);
  v_precision numeric(5,2);
  v_devoluciones numeric(5,2);
  v_aprobacion numeric(5,2);
  v_nivel int;
  v_anterior int;
  v_row public.analista_metricas;
BEGIN
  SELECT COUNT(*), COALESCE(AVG(score_total), 0)
    INTO v_total, v_score
    FROM public.audit_simulaciones
    WHERE analista_id = _user_id;

  SELECT COALESCE(AVG(
    CASE
      WHEN cuota_propuesta IS NOT NULL AND cuota_aprobada IS NOT NULL
           AND cuota_propuesta > 0
      THEN GREATEST(0, 100 - LEAST(100, ABS(cuota_aprobada - cuota_propuesta) / cuota_propuesta * 100))
      ELSE NULL
    END
  ), 0) INTO v_precision
  FROM public.audit_respuestas_banco
  WHERE analista_id = _user_id;

  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE requiere_revision)
    / NULLIF(COUNT(*), 0), 0
  ) INTO v_devoluciones
  FROM public.audit_simulaciones
  WHERE analista_id = _user_id;

  v_aprobacion := GREATEST(0, 100 - v_devoluciones);

  v_nivel := CASE
    WHEN v_total >= 100 AND v_score >= 95 THEN 3
    WHEN v_total >= 30  AND v_score >= 85 THEN 2
    ELSE 1
  END;

  SELECT nivel_autonomia INTO v_anterior
    FROM public.analista_metricas WHERE analista_id = _user_id;

  INSERT INTO public.analista_metricas (
    analista_id, total_simulaciones, score_promedio,
    precision_historica, porcentaje_devoluciones,
    porcentaje_aprobacion_banco, nivel_autonomia, ultimo_recalculo
  ) VALUES (
    _user_id, v_total, v_score, v_precision, v_devoluciones, v_aprobacion, v_nivel, now()
  )
  ON CONFLICT (analista_id) DO UPDATE SET
    total_simulaciones = EXCLUDED.total_simulaciones,
    score_promedio = EXCLUDED.score_promedio,
    precision_historica = EXCLUDED.precision_historica,
    porcentaje_devoluciones = EXCLUDED.porcentaje_devoluciones,
    porcentaje_aprobacion_banco = EXCLUDED.porcentaje_aprobacion_banco,
    nivel_autonomia = EXCLUDED.nivel_autonomia,
    ultimo_recalculo = now()
  RETURNING * INTO v_row;

  IF v_anterior IS NOT NULL AND v_anterior <> v_nivel THEN
    INSERT INTO public.audit_alertas (analista_id, tipo, nivel_anterior, nivel_nuevo, mensaje)
    VALUES (_user_id, 'cambio_nivel', v_anterior, v_nivel,
      'Tu nivel de autonomía cambió de ' || v_anterior || ' a ' || v_nivel);
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_nivel_autonomia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_nivel_autonomia(uuid) TO authenticated, service_role;

-- Trigger: recalcular al insertar simulación o respuesta banco
CREATE OR REPLACE FUNCTION public.trg_recalc_nivel_autonomia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_nivel_autonomia(NEW.analista_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sim_nivel ON public.audit_simulaciones;
CREATE TRIGGER trg_audit_sim_nivel
AFTER INSERT ON public.audit_simulaciones
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_nivel_autonomia();

DROP TRIGGER IF EXISTS trg_audit_resp_nivel ON public.audit_respuestas_banco;
CREATE TRIGGER trg_audit_resp_nivel
AFTER INSERT OR UPDATE ON public.audit_respuestas_banco
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_nivel_autonomia();
