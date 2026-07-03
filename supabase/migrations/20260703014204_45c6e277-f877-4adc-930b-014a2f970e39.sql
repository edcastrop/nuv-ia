
CREATE OR REPLACE FUNCTION public.nuvia_guard_expediente_no_wipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cliente_patch jsonb;
  v_nombre_json text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.cliente_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.cliente_data, '{}'::jsonb), COALESCE(NEW.cliente_data, '{}'::jsonb));
    NEW.credito_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.credito_data, '{}'::jsonb), COALESCE(NEW.credito_data, '{}'::jsonb));
    NEW.propuesta_data := CASE
      WHEN public.nuvia_jsonb_meaningful(COALESCE(NEW.propuesta_data, '{}'::jsonb)) THEN NEW.propuesta_data
      ELSE OLD.propuesta_data
    END;
    NEW.discount_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.discount_data, '{}'::jsonb), COALESCE(NEW.discount_data, '{}'::jsonb));

    -- Rescatar el nombre desde cliente_data->>'nombre' si viene vacío en la columna.
    v_nombre_json := btrim(COALESCE(NEW.cliente_data->>'nombre', ''));

    NEW.cliente_nombre := COALESCE(
      NULLIF(btrim(NEW.cliente_nombre), ''),
      CASE WHEN lower(COALESCE(btrim(OLD.cliente_nombre),'')) <> 'sin nombre'
           THEN NULLIF(btrim(OLD.cliente_nombre), '') END,
      CASE WHEN v_nombre_json <> '' AND lower(v_nombre_json) <> 'sin nombre'
           THEN v_nombre_json END,
      OLD.cliente_nombre  -- último recurso: preservar exactamente lo que había
    );

    NEW.cedula := COALESCE(NULLIF(NEW.cedula, ''), OLD.cedula);
    NEW.banco := COALESCE(NULLIF(NEW.banco, ''), OLD.banco);
    NEW.numero_credito := COALESCE(NULLIF(NEW.numero_credito, ''), OLD.numero_credito);
    NEW.producto := COALESCE(NULLIF(NEW.producto, ''), OLD.producto);
  END IF;

  cliente_patch := jsonb_build_object(
    'nombre', NULLIF(NEW.cliente_nombre, ''),
    'cedula', NULLIF(NEW.cedula, ''),
    'banco', NULLIF(NEW.banco, ''),
    'numeroCredito', NULLIF(NEW.numero_credito, ''),
    'tipoProducto', NULLIF(NEW.producto, ''),
    'porcentajeHonorarios', COALESCE(NULLIF(NEW.cliente_data->>'porcentajeHonorarios', ''), '6')
  );
  NEW.cliente_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(NEW.cliente_data, '{}'::jsonb), cliente_patch);
  RETURN NEW;
END;
$function$;
