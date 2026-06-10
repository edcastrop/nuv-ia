CREATE OR REPLACE FUNCTION public.trg_wallet_from_comision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_delta_liberada numeric(14,2);
  v_delta_pagada numeric(14,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id, metadata)
    VALUES (
      NEW.user_id,
      'comision_generada'::public.wallet_mov_tipo,
      COALESCE(NEW.comision_potencial, NEW.valor, 0),
      'Comisión generada (potencial)',
      NEW.id,
      jsonb_build_object('expediente_id', NEW.expediente_id, 'rol', NEW.rol)
    );

    IF COALESCE(NEW.comision_liberada, 0) > 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (
        NEW.user_id,
        'comision_liberada'::public.wallet_mov_tipo,
        NEW.comision_liberada,
        'Comisión liberada por recaudo',
        NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_delta_liberada := COALESCE(NEW.comision_liberada, 0) - COALESCE(OLD.comision_liberada, 0);
    v_delta_pagada := COALESCE(NEW.comision_pagada, 0) - COALESCE(OLD.comision_pagada, 0);

    IF v_delta_liberada <> 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (
        NEW.user_id,
        CASE
          WHEN v_delta_liberada > 0 THEN 'comision_liberada'::public.wallet_mov_tipo
          ELSE 'ajuste_debito'::public.wallet_mov_tipo
        END,
        ABS(v_delta_liberada),
        CASE WHEN v_delta_liberada > 0 THEN 'Liberación por recaudo' ELSE 'Reversión de liberación' END,
        NEW.id
      );
    END IF;

    IF v_delta_pagada <> 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (
        NEW.user_id,
        CASE
          WHEN v_delta_pagada > 0 THEN 'comision_pagada'::public.wallet_mov_tipo
          ELSE 'ajuste_credito'::public.wallet_mov_tipo
        END,
        ABS(v_delta_pagada),
        CASE WHEN v_delta_pagada > 0 THEN 'Pago de comisión' ELSE 'Reversión de pago' END,
        NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;