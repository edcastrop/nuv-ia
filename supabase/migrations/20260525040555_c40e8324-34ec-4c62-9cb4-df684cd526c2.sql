-- Fase 3 — Comisiones parametrizables, anti-duplicado, devolución

-- 1) Actualizar trigger auto_liquidar_comision para usar parámetro como fallback
CREATE OR REPLACE FUNCTION public.auto_liquidar_comision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regla record;
  v_base numeric(14,2);
  v_porc numeric(5,2);
  v_valor numeric(14,2);
  v_default numeric(5,2);
BEGIN
  IF NEW.estado_caso = 'honorarios_pagados'
     AND (OLD.estado_caso IS DISTINCT FROM NEW.estado_caso) THEN

    -- Base = honorarios_final (ya incluye recálculo a éxito de Fase 1)
    v_base := COALESCE(NEW.honorarios_final, 0);
    IF v_base <= 0 THEN RETURN NEW; END IF;

    -- Regla específica del licenciado (banco o general)
    SELECT * INTO v_regla FROM public.comisiones_reglas
      WHERE user_id = NEW.asesor_id AND activo = true
        AND (banco = NEW.banco OR banco IS NULL)
      ORDER BY (banco = NEW.banco) DESC NULLS LAST
      LIMIT 1;

    -- Fallback al parámetro global
    IF v_regla IS NULL THEN
      SELECT (valor#>>'{}')::numeric INTO v_default
        FROM public.parametros_financieros
        WHERE clave = 'comision_predeterminada_licenciado';
      v_porc := COALESCE(v_default, 50);
    ELSE
      v_porc := COALESCE(v_regla.porcentaje, 0);
    END IF;

    v_valor := ROUND(v_base * v_porc / 100, 2);

    INSERT INTO public.comisiones (expediente_id, user_id, rol, base, porcentaje, valor, estado)
    VALUES (NEW.id, NEW.asesor_id, COALESCE(v_regla.rol,'licenciado'), v_base, v_porc, v_valor, 'generada')
    ON CONFLICT (expediente_id, user_id, rol) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 2) Índice anti-duplicado: una comisión solo puede estar en UNA cuenta de cobro activa
--    (estado distinto de 'rechazada'/'generada' sin CC)
CREATE UNIQUE INDEX IF NOT EXISTS uq_comisiones_expediente_cc_activa
  ON public.comisiones (expediente_id, user_id, rol)
  WHERE cuenta_cobro_id IS NOT NULL AND estado <> 'rechazada';
