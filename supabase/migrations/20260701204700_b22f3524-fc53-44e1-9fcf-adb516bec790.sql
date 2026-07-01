CREATE OR REPLACE FUNCTION public.nuvia_jsonb_meaningful(_v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _v IS NULL OR _v = 'null'::jsonb THEN false
    WHEN jsonb_typeof(_v) = 'string' THEN length(btrim(_v #>> '{}')) > 0
    WHEN jsonb_typeof(_v) = 'number' THEN true
    WHEN jsonb_typeof(_v) = 'boolean' THEN (_v)::text = 'true'
    WHEN jsonb_typeof(_v) = 'array' THEN EXISTS (SELECT 1 FROM jsonb_array_elements(_v) AS e WHERE public.nuvia_jsonb_meaningful(e))
    WHEN jsonb_typeof(_v) = 'object' THEN EXISTS (SELECT 1 FROM jsonb_each(_v) AS kv WHERE public.nuvia_jsonb_meaningful(kv.value))
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_jsonb_deep_merge_non_empty(_base jsonb, _patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result jsonb := COALESCE(_base, '{}'::jsonb);
  k text;
  v jsonb;
BEGIN
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RETURN result;
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(_patch) LOOP
    IF NOT public.nuvia_jsonb_meaningful(v) THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(result -> k) = 'object' AND jsonb_typeof(v) = 'object' THEN
      result := jsonb_set(result, ARRAY[k], public.nuvia_jsonb_deep_merge_non_empty(result -> k, v), true);
    ELSE
      result := jsonb_set(result, ARRAY[k], v, true);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_patch_expediente_from_extracto(_exp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ext record;
  exp record;
  d jsonb := '{}'::jsonb;
  cliente_patch jsonb := '{}'::jsonb;
  credito_patch jsonb := '{}'::jsonb;
  producto_final text;
BEGIN
  SELECT * INTO exp FROM public.expedientes WHERE id = _exp_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT banco, producto, moneda, datos
    INTO ext
  FROM public.extractos_lecturas
  WHERE expediente_id = _exp_id
  ORDER BY created_at DESC
  LIMIT 1;

  d := COALESCE(ext.datos, '{}'::jsonb);
  producto_final := NULLIF(COALESCE(exp.producto, d->>'tipoProducto', d->>'producto', ext.producto), '');

  cliente_patch := jsonb_build_object(
    'nombre', COALESCE(NULLIF(exp.cliente_nombre, ''), NULLIF(d->>'cliente', ''), NULLIF(d->>'titular', '')),
    'cedula', COALESCE(NULLIF(exp.cedula, ''), NULLIF(d->>'cedula', ''), NULLIF(d->>'documento', '')),
    'banco', COALESCE(NULLIF(exp.banco, ''), NULLIF(d->>'banco', ''), ext.banco),
    'numeroCredito', COALESCE(NULLIF(exp.numero_credito, ''), NULLIF(d->>'numeroCredito', '')),
    'tipoProducto', producto_final,
    'plazoInicial', COALESCE(NULLIF(exp.cliente_data->>'plazoInicial', ''), NULLIF(d->>'plazoInicial', ''), NULLIF(d->>'cuotasTotales', '')),
    'cuotasPagadas', COALESCE(NULLIF(exp.cliente_data->>'cuotasPagadas', ''), NULLIF(d->>'cuotasPagadas', '')),
    'cuotasPendientes', COALESCE(NULLIF(exp.cliente_data->>'cuotasPendientes', ''), NULLIF(d->>'cuotasPendientes', '')),
    'porcentajeHonorarios', COALESCE(NULLIF(exp.cliente_data->>'porcentajeHonorarios', ''), '6'),
    'cobertura', jsonb_build_object(
      'activo', COALESCE(NULLIF(d->>'tasaCobertura', ''), NULLIF(d->>'valorCobertura', ''), NULLIF(d->>'valorSubsidioGobierno', '')) IS NOT NULL,
      'tasaCobertura', COALESCE(NULLIF(d->>'tasaCobertura', ''), ''),
      'valorCobertura', COALESCE(NULLIF(d->>'valorCobertura', ''), NULLIF(d->>'valorSubsidioGobierno', ''), '')
    )
  );

  credito_patch := jsonb_build_object(
    'tea', COALESCE(NULLIF(exp.credito_data->>'tea', ''), NULLIF(d->>'teaPactada', ''), NULLIF(d->>'tasaEA', ''), NULLIF(d->>'tea', '')),
    'teaCobrada', COALESCE(NULLIF(exp.credito_data->>'teaCobrada', ''), NULLIF(d->>'teaCobrada', ''), NULLIF(d->>'tasaEA', '')),
    'cuotaActual', COALESCE(NULLIF(exp.credito_data->>'cuotaActual', ''), NULLIF(d->>'cuotaActual', ''), NULLIF(d->>'cuotaMensual', ''), NULLIF(d->>'valorAPagar', ''), NULLIF(d->>'cuotaPagadaCliente', '')),
    'cuotaActualPesos', COALESCE(NULLIF(exp.credito_data->>'cuotaActualPesos', ''), NULLIF(d->>'cuotaActualPesos', ''), NULLIF(d->>'cuotaActual', ''), NULLIF(d->>'cuotaMensual', ''), NULLIF(d->>'valorAPagar', ''), NULLIF(d->>'cuotaPagadaCliente', '')),
    'saldoCapital', COALESCE(NULLIF(exp.credito_data->>'saldoCapital', ''), NULLIF(d->>'saldoCapital', ''), NULLIF(d->>'saldoPesos', '')),
    'saldoPesos', COALESCE(NULLIF(exp.credito_data->>'saldoPesos', ''), NULLIF(d->>'saldoPesos', ''), NULLIF(d->>'saldoCapital', '')),
    'saldoUVR', COALESCE(NULLIF(exp.credito_data->>'saldoUVR', ''), NULLIF(d->>'saldoUVR', '')),
    'valorUVR', COALESCE(NULLIF(exp.credito_data->>'valorUVR', ''), NULLIF(d->>'valorUVR', '')),
    'seguros', COALESCE(NULLIF(exp.credito_data->>'seguros', ''), NULLIF(d->>'seguros', '')),
    'valorDesembolsado', COALESCE(NULLIF(exp.credito_data->>'valorDesembolsado', ''), NULLIF(d->>'valorDesembolsado', '')),
    'cuotaConInteresSinSeguros', COALESCE(NULLIF(exp.credito_data->>'cuotaConInteresSinSeguros', ''), NULLIF(d->>'cuotaConInteresSinSeguros', ''), NULLIF(d->>'cuotaSinSeguros', '')),
    'cuotaBaseSimulacion', COALESCE(NULLIF(exp.credito_data->>'cuotaBaseSimulacion', ''), NULLIF(d->>'cuotaBaseSimulacion', ''), NULLIF(d->>'cuotaSinSubsidio', ''))
  );

  UPDATE public.expedientes
  SET
    cliente_nombre = COALESCE(NULLIF(cliente_nombre, ''), NULLIF(cliente_patch->>'nombre', ''), cliente_nombre),
    cedula = COALESCE(NULLIF(cedula, ''), NULLIF(cliente_patch->>'cedula', ''), cedula),
    banco = COALESCE(NULLIF(banco, ''), NULLIF(cliente_patch->>'banco', ''), banco),
    numero_credito = COALESCE(NULLIF(numero_credito, ''), NULLIF(cliente_patch->>'numeroCredito', ''), numero_credito),
    producto = COALESCE(NULLIF(producto, ''), NULLIF(cliente_patch->>'tipoProducto', ''), producto),
    cliente_data = public.nuvia_jsonb_deep_merge_non_empty(COALESCE(cliente_data, '{}'::jsonb), cliente_patch),
    credito_data = public.nuvia_jsonb_deep_merge_non_empty(COALESCE(credito_data, '{}'::jsonb), credito_patch),
    updated_at = now()
  WHERE id = _exp_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_guard_expediente_no_wipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cliente_patch jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.cliente_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.cliente_data, '{}'::jsonb), COALESCE(NEW.cliente_data, '{}'::jsonb));
    NEW.credito_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.credito_data, '{}'::jsonb), COALESCE(NEW.credito_data, '{}'::jsonb));
    NEW.propuesta_data := CASE
      WHEN public.nuvia_jsonb_meaningful(COALESCE(NEW.propuesta_data, '{}'::jsonb)) THEN NEW.propuesta_data
      ELSE OLD.propuesta_data
    END;
    NEW.discount_data := public.nuvia_jsonb_deep_merge_non_empty(COALESCE(OLD.discount_data, '{}'::jsonb), COALESCE(NEW.discount_data, '{}'::jsonb));
    NEW.cliente_nombre := COALESCE(NULLIF(NEW.cliente_nombre, ''), NULLIF(OLD.cliente_nombre, ''), 'Sin nombre');
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
$$;

DROP TRIGGER IF EXISTS trg_nuvia_guard_expediente_no_wipe ON public.expedientes;
CREATE TRIGGER trg_nuvia_guard_expediente_no_wipe
BEFORE INSERT OR UPDATE ON public.expedientes
FOR EACH ROW EXECUTE FUNCTION public.nuvia_guard_expediente_no_wipe();

SELECT public.nuvia_patch_expediente_from_extracto(expediente_id)
FROM public.qa_auditorias
WHERE codigo = 'NUV_AUD_2026_MG_00031'
  AND expediente_id IS NOT NULL;

UPDATE public.expedientes e
SET
  qa_auditoria_id = q.id,
  qa_score = q.qa_score,
  qa_dictamen = q.dictamen,
  qa_categoria = q.categoria,
  qa_ejecutada_at = COALESCE(q.ejecutado_at, q.created_at),
  updated_at = now()
FROM public.qa_auditorias q
WHERE q.codigo = 'NUV_AUD_2026_MG_00031'
  AND e.id = q.expediente_id;