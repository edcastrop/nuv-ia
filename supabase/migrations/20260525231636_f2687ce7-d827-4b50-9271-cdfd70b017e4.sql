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
          estado = CASE
            WHEN COALESCE(comision_liberada,0) > COALESCE(comision_pagada,0) + COALESCE(valor,0)
              THEN 'generada'
            ELSE 'pagada'
          END,
          cuenta_cobro_id = CASE
            WHEN COALESCE(comision_liberada,0) > COALESCE(comision_pagada,0) + COALESCE(valor,0)
              THEN NULL
            ELSE cuenta_cobro_id
          END,
          updated_at = now()
      WHERE cuenta_cobro_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;