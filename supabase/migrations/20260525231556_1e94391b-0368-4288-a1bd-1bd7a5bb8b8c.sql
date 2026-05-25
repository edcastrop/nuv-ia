-- Comisiones liberadas según recaudo real
ALTER TABLE public.comisiones
  ADD COLUMN IF NOT EXISTS honorarios_contratados numeric(14,2),
  ADD COLUMN IF NOT EXISTS recaudado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comision_potencial numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comision_liberada numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comision_pagada numeric(14,2) NOT NULL DEFAULT 0;

-- Función para liberar comisiones según recaudo del expediente
CREATE OR REPLACE FUNCTION public.liberar_comisiones_por_recaudo(_expediente_id uuid, _user_validador uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recaudado numeric(14,2);
  v_honorarios numeric(14,2);
  v_asesor uuid;
  v_porc numeric(5,2);
  v_default numeric(5,2);
  v_banco text;
  v_regla record;
  v_comision_id uuid;
  v_liberada_prev numeric(14,2);
  v_liberada_new numeric(14,2);
  v_potencial numeric(14,2);
BEGIN
  -- Total recaudado: sumar pagos de cartera ligados al expediente
  SELECT COALESCE(SUM(p.valor),0) INTO v_recaudado
    FROM public.cartera_pagos p
    JOIN public.cartera c ON c.id = p.cartera_id
    WHERE c.expediente_id = _expediente_id;

  SELECT COALESCE(honorarios_final,0), asesor_id, banco
    INTO v_honorarios, v_asesor, v_banco
    FROM public.expedientes WHERE id = _expediente_id;

  IF v_asesor IS NULL OR COALESCE(v_honorarios,0) <= 0 THEN RETURN; END IF;

  -- Resolver porcentaje
  SELECT * INTO v_regla FROM public.comisiones_reglas
    WHERE user_id = v_asesor AND activo = true
      AND (banco = v_banco OR banco IS NULL)
    ORDER BY (banco = v_banco) DESC NULLS LAST LIMIT 1;
  IF v_regla IS NULL THEN
    SELECT (valor#>>'{}')::numeric INTO v_default
      FROM public.parametros_financieros WHERE clave = 'comision_predeterminada_licenciado';
    v_porc := COALESCE(v_default, 50);
  ELSE
    v_porc := COALESCE(v_regla.porcentaje, 50);
  END IF;

  v_potencial := ROUND(v_honorarios * v_porc / 100, 2);
  v_liberada_new := ROUND(v_recaudado * v_porc / 100, 2);

  -- Asegurar la comisión existe
  SELECT id, comision_liberada INTO v_comision_id, v_liberada_prev
    FROM public.comisiones
    WHERE expediente_id = _expediente_id AND user_id = v_asesor
    ORDER BY created_at ASC LIMIT 1;

  IF v_comision_id IS NULL THEN
    INSERT INTO public.comisiones (
      expediente_id, user_id, rol, base, porcentaje, valor,
      honorarios_contratados, recaudado, comision_potencial, comision_liberada, estado
    ) VALUES (
      _expediente_id, v_asesor, COALESCE(v_regla.rol,'licenciado'),
      v_honorarios, v_porc, v_potencial,
      v_honorarios, v_recaudado, v_potencial, v_liberada_new,
      CASE WHEN v_liberada_new > 0 THEN 'generada' ELSE 'generada' END
    )
    RETURNING id, 0 INTO v_comision_id, v_liberada_prev;
  ELSE
    UPDATE public.comisiones
      SET honorarios_contratados = v_honorarios,
          recaudado = v_recaudado,
          comision_potencial = v_potencial,
          comision_liberada = v_liberada_new,
          base = v_honorarios,
          porcentaje = v_porc,
          valor = v_potencial,
          updated_at = now()
      WHERE id = v_comision_id;
  END IF;

  -- Auditoría + alerta si hay nuevo liberable
  IF COALESCE(v_liberada_new,0) > COALESCE(v_liberada_prev,0) THEN
    INSERT INTO public.finanzas_auditoria (entidad, entidad_id, accion, user_id, valor_anterior, valor_nuevo)
    VALUES ('comision', v_comision_id, 'comision_liberada', _user_validador,
      jsonb_build_object('comision_liberada', v_liberada_prev, 'recaudado_previo', NULL),
      jsonb_build_object('comision_liberada', v_liberada_new, 'recaudado', v_recaudado, 'porcentaje', v_porc));

    INSERT INTO public.finanzas_alertas (tipo, severidad, titulo, mensaje_ia, expediente_id)
    VALUES ('comision_liberada','media',
      'Comisión disponible para cuenta de cobro',
      'Se liberó nueva comisión por recaudo de cartera.',
      _expediente_id);
  END IF;
END;
$$;

-- Trigger sobre cartera_pagos
CREATE OR REPLACE FUNCTION public.trg_liberar_comisiones_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp uuid;
  v_cart uuid;
BEGIN
  v_cart := COALESCE(NEW.cartera_id, OLD.cartera_id);
  SELECT expediente_id INTO v_exp FROM public.cartera WHERE id = v_cart;
  IF v_exp IS NOT NULL THEN
    PERFORM public.liberar_comisiones_por_recaudo(v_exp, COALESCE(NEW.user_id, OLD.user_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS cartera_pagos_libera_comision ON public.cartera_pagos;
CREATE TRIGGER cartera_pagos_libera_comision
AFTER INSERT OR UPDATE OR DELETE ON public.cartera_pagos
FOR EACH ROW EXECUTE FUNCTION public.trg_liberar_comisiones_pago();

-- Función disponible para cuenta de cobro
CREATE OR REPLACE FUNCTION public.comision_disponible_para_cc(_comision_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE(c.comision_liberada,0)
    - COALESCE(c.comision_pagada,0)
    - COALESCE((
        SELECT SUM(cc.total) FROM public.cuentas_cobro cc
        WHERE cc.id = c.cuenta_cobro_id
          AND cc.estado IN ('borrador','enviada','aprobada','programada_pago','devuelta_correccion')
      ),0)
  , 0)
  FROM public.comisiones c WHERE c.id = _comision_id;
$$;

-- Trigger que actualiza comision_pagada cuando la CC pasa a pagada
CREATE OR REPLACE FUNCTION public.trg_cc_marca_pagada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'pagada' AND (OLD.estado IS DISTINCT FROM 'pagada') THEN
    UPDATE public.comisiones
      SET comision_pagada = COALESCE(comision_pagada,0) + COALESCE(valor,0),
          estado = 'pagada',
          updated_at = now()
      WHERE cuenta_cobro_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cc_marca_pagada ON public.cuentas_cobro;
CREATE TRIGGER cc_marca_pagada
AFTER UPDATE OF estado ON public.cuentas_cobro
FOR EACH ROW EXECUTE FUNCTION public.trg_cc_marca_pagada();

-- Backfill: recalcular para todos los expedientes existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.expedientes WHERE honorarios_final > 0 LOOP
    PERFORM public.liberar_comisiones_por_recaudo(r.id, NULL);
  END LOOP;
  -- Sincronizar comision_pagada con CC pagadas existentes
  UPDATE public.comisiones c
    SET comision_pagada = COALESCE((
      SELECT SUM(cc.total) FROM public.cuentas_cobro cc
      WHERE cc.id = c.cuenta_cobro_id AND cc.estado = 'pagada'
    ),0);
END $$;