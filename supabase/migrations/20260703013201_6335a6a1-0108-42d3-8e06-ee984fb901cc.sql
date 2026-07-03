
-- 1) BEFORE INSERT: bloquear cualquier expediente que llegue sin nombre real.
CREATE OR REPLACE FUNCTION public.nuvia_guard_expediente_requiere_nombre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nombre text;
BEGIN
  v_nombre := btrim(COALESCE(NEW.cliente_nombre, ''));

  -- Intentar rescatar el nombre desde cliente_data si venía vacío en la columna.
  IF v_nombre = '' OR lower(v_nombre) = 'sin nombre' THEN
    v_nombre := btrim(COALESCE(NEW.cliente_data->>'nombre', ''));
    IF v_nombre <> '' AND lower(v_nombre) <> 'sin nombre' THEN
      NEW.cliente_nombre := v_nombre;
    END IF;
  END IF;

  IF v_nombre = '' OR lower(v_nombre) = 'sin nombre' THEN
    RAISE EXCEPTION
      'NUVIA_NOMBRE_REQUERIDO: no se puede crear un expediente sin el NOMBRE del cliente. Aplica la lectura del extracto o completa la ficha del cliente antes de guardar.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nuvia_guard_expediente_requiere_nombre ON public.expedientes;
CREATE TRIGGER trg_nuvia_guard_expediente_requiere_nombre
  BEFORE INSERT ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_expediente_requiere_nombre();

-- 2) Limpieza de casos huérfanos "Sin nombre" totalmente vacíos.
DELETE FROM public.expedientes
WHERE (cliente_nombre IS NULL
       OR btrim(cliente_nombre) = ''
       OR lower(btrim(cliente_nombre)) = 'sin nombre')
  AND (cedula IS NULL OR btrim(cedula) = '')
  AND (banco IS NULL OR btrim(banco) = '')
  AND (numero_credito IS NULL OR btrim(numero_credito) = '');
