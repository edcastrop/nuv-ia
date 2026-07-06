CREATE OR REPLACE FUNCTION public.validate_expediente_operativo_completo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  saldo_text text;
  cuota_text text;
  tasa_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    saldo_text := btrim(coalesce(NEW.credito_data->>'saldoCapital', NEW.credito_data->>'saldoPesos', ''));
    cuota_text := btrim(coalesce(NEW.credito_data->>'cuotaActual', NEW.credito_data->>'cuotaActualPesos', ''));
    tasa_text := btrim(coalesce(NEW.credito_data->>'tea', NEW.credito_data->>'teaCobrada', ''));

    IF btrim(coalesce(NEW.cliente_nombre, '')) = '' OR lower(btrim(coalesce(NEW.cliente_nombre, ''))) = 'sin nombre' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin nombre del cliente';
    END IF;

    IF btrim(coalesce(NEW.cedula, '')) = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin cedula del cliente';
    END IF;

    IF btrim(coalesce(NEW.banco, '')) = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin banco';
    END IF;

    IF btrim(coalesce(NEW.producto, '')) = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin producto';
    END IF;

    IF btrim(coalesce(NEW.numero_credito, '')) = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin numero de credito';
    END IF;

    IF saldo_text = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin saldo capital';
    END IF;

    IF cuota_text = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin cuota actual';
    END IF;

    IF tasa_text = '' THEN
      RAISE EXCEPTION 'No se puede crear un caso operativo sin tasa del credito';
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