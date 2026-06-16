CREATE SCHEMA IF NOT EXISTS audit;
GRANT USAGE ON SCHEMA audit TO authenticated, service_role;

CREATE OR REPLACE FUNCTION audit.rls_counts_as(_user_id uuid)
RETURNS TABLE(tabla text, visibles bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims text := json_build_object('sub', _user_id, 'role','authenticated')::text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', v_claims, true);
  RETURN QUERY SELECT 'expedientes'::text, count(*)::bigint FROM public.expedientes;
  RETURN QUERY SELECT 'cuentas_cobro', count(*) FROM public.cuentas_cobro;
  RETURN QUERY SELECT 'cartera', count(*) FROM public.cartera;
  RETURN QUERY SELECT 'cartera_pagos', count(*) FROM public.cartera_pagos;
  RETURN QUERY SELECT 'honorarios_calculos', count(*) FROM public.honorarios_calculos;
  RETURN QUERY SELECT 'comisiones', count(*) FROM public.comisiones;
  RETURN QUERY SELECT 'nomina_pagos', count(*) FROM public.nomina_pagos;
  RETURN QUERY SELECT 'profiles', count(*) FROM public.profiles;
  RETURN QUERY SELECT 'user_roles', count(*) FROM public.user_roles;
  RETURN QUERY SELECT 'treasury_movimientos', count(*) FROM public.treasury_movimientos;
END $$;

REVOKE ALL ON FUNCTION audit.rls_counts_as(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit.rls_counts_as(uuid) TO authenticated, service_role;

DO $$
DECLARE
  v_id          uuid := 'e9cdc586-316d-4971-951e-b5382566684d';
  v_asesor      uuid;
  v_cliente_nom text;
  v_banco       text;
  v_licenciado  uuid := 'b47618cc-f391-41dc-bc8f-bbdbb626fbea';
  v_contab      uuid := '6943df29-783f-4360-8e68-24e82e183a79';
  v_dir_fin     uuid := 'db0f8c0b-ff38-40f8-8f10-32a91aefc490';
  v_now         timestamptz := now();
  v_honor       numeric := 4392968;
  v_cartera_id  uuid;
BEGIN
  SELECT asesor_id, cliente_nombre, banco
    INTO v_asesor, v_cliente_nom, v_banco
  FROM public.expedientes WHERE id = v_id;

  UPDATE public.expedientes SET
    estado = 'PAGADO',
    estado_caso = 'paz_y_salvo_generado',
    validacion_estado = 'datos_validados',
    validacion_confirmado_licenciado = true,
    validacion_confirmado_at = v_now - interval '20 days',
    validacion_enviado_at = v_now - interval '19 days',
    validacion_aprobado_por = v_licenciado,
    validacion_aprobado_at = v_now - interval '18 days',
    radicado_id_banco = 'RAD-AUDIT-001',
    radicado_fecha = v_now - interval '15 days',
    aceptacion_cliente_at = v_now - interval '10 days',
    aceptacion_medio = 'whatsapp',
    aceptacion_observaciones = 'Auditoría iter 2',
    aprobado_data = jsonb_build_object('cuota_aprobada',1850000,'plazo_aprobado',96,'tasa_aprobada',1.45,'fecha_aprobacion',(v_now-interval '12 days')::text),
    cuotas_pactadas = 96, cuotas_aprobadas_banco = 96,
    honorarios_pactados = v_honor, honorarios_recalculados = v_honor, honorarios_final = v_honor,
    qa_score = 92.5, qa_dictamen = 'aprobado', qa_categoria = 'aprobado',
    qa_ejecutada_at = v_now - interval '14 days',
    verificacion_cierre = jsonb_build_object('checklist_completo',true,'cerrado_at',v_now::text),
    updated_at = v_now
  WHERE id = v_id;

  INSERT INTO public.cartera (
    expediente_id, responsable_id, estado_cartera, forma_pago,
    fecha_aplicacion_banco, fecha_vencimiento, honorarios_totales, pagado, created_by)
  VALUES (
    v_id, v_contab, 'pago_total', 'contado',
    (v_now - interval '8 days')::date, (v_now + interval '22 days')::date, v_honor, v_honor, v_dir_fin)
  ON CONFLICT (expediente_id) DO UPDATE
    SET estado_cartera = EXCLUDED.estado_cartera, pagado = EXCLUDED.pagado, updated_at = v_now
  RETURNING id INTO v_cartera_id;
  IF v_cartera_id IS NULL THEN
    SELECT id INTO v_cartera_id FROM public.cartera WHERE expediente_id = v_id;
  END IF;

  INSERT INTO public.cuentas_cobro (numero, user_id, total, estado, fecha_envio, fecha_aprobacion, fecha_pago, observaciones)
  VALUES (
    'CC-AUDIT-' || substr(v_id::text,1,8), v_asesor, v_honor, 'pagada',
    v_now - interval '7 days', v_now - interval '6 days', v_now - interval '3 days',
    'Auditoría iter 2 — CC asociada al expediente ' || v_id::text)
  ON CONFLICT (numero) DO NOTHING;

  INSERT INTO public.honorarios_calculos (
    expediente_id, cliente_nombre, banco, tipo_credito,
    saldo_capital, ahorro_intereses, ahorro_seguros, ahorro_total,
    clasificacion, porcentaje_aplicado, honorario_teorico, honorario_topado,
    honorario_ofertado, descuento_aplicado_pct, estado, notas, created_by)
  VALUES (
    v_id, v_cliente_nom, v_banco, 'pesos',
    141764650, 18000000, 1500000, 19500000,
    'estandar', 22.5, 4500000, 4500000,
    v_honor, 2.4, 'aprobado', 'Auditoría iter 2', v_dir_fin);

  IF v_cartera_id IS NOT NULL THEN
    INSERT INTO public.cartera_pagos (
      cartera_id, fecha, valor, metodo, banco_receptor, comprobante_num,
      observaciones, user_id, valor_bruto, valor_neto, numero_transaccion)
    VALUES (
      v_cartera_id, (v_now - interval '3 days')::date, v_honor, 'transferencia',
      'Bancolombia', 'AUDIT-COMP-001', 'Auditoría iter 2', v_contab,
      v_honor, v_honor, 'AUDIT-TXN-001');
  END IF;

  INSERT INTO public.expediente_bitacora (expediente_id, usuario_id, comentario, tipo) VALUES
    (v_id, v_contab,  'Auditoría iter 2 — pago conciliado', 'sistema'),
    (v_id, v_dir_fin, 'Auditoría iter 2 — paz y salvo emitido', 'sistema');
END $$;