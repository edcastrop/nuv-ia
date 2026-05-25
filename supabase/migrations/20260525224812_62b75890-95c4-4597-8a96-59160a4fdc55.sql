
CREATE OR REPLACE FUNCTION public.map_caso_to_expediente_estado(_caso caso_estado)
 RETURNS expediente_estado
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _caso
    -- Pre-firma → SIMULADO
    WHEN 'lead_creado'              THEN 'SIMULADO'::expediente_estado
    WHEN 'prospecto'                THEN 'SIMULADO'::expediente_estado
    WHEN 'extracto_recibido'        THEN 'SIMULADO'::expediente_estado
    WHEN 'simulacion_realizada'     THEN 'SIMULADO'::expediente_estado
    WHEN 'simulado'                 THEN 'SIMULADO'::expediente_estado
    WHEN 'propuesta_presentada'     THEN 'SIMULADO'::expediente_estado
    WHEN 'propuesta_enviada'        THEN 'SIMULADO'::expediente_estado
    WHEN 'acepto_propuesta'         THEN 'SIMULADO'::expediente_estado
    WHEN 'negociacion'              THEN 'SIMULADO'::expediente_estado
    WHEN 'pendiente_contratacion'   THEN 'SIMULADO'::expediente_estado

    WHEN 'enviado_contratacion'     THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_enviado'         THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_generado'        THEN 'ENVIADO_CONTRATACION'::expediente_estado

    WHEN 'contrato_firmado'         THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_generado'           THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_firmado'            THEN 'FIRMADO'::expediente_estado
    WHEN 'documentacion_completa'   THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_pendiente'     THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_preparada'     THEN 'FIRMADO'::expediente_estado

    WHEN 'radicado_banco'             THEN 'RADICADO'::expediente_estado
    WHEN 'en_estudio_banco'           THEN 'RADICADO'::expediente_estado
    WHEN 'docs_complementarios_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'devuelto_banco'             THEN 'RADICADO'::expediente_estado

    -- Aprobado banco → APROBADO
    WHEN 'aprobado'                   THEN 'APROBADO'::expediente_estado
    WHEN 'aprobado_banco'             THEN 'APROBADO'::expediente_estado

    -- Condiciones aplicadas → CONDICIONES_APLICADAS
    WHEN 'documentos_banco_firmados'  THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'condiciones_aplicadas'      THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'aplicado_banco'             THEN 'CONDICIONES_APLICADAS'::expediente_estado
    WHEN 'resultado_final_generado'   THEN 'CONDICIONES_APLICADAS'::expediente_estado

    WHEN 'cuenta_cobro_generada'  THEN 'FACTURADO'::expediente_estado
    WHEN 'cuenta_cobro_enviada'   THEN 'FACTURADO'::expediente_estado
    WHEN 'honorarios_pendientes'  THEN 'FACTURADO'::expediente_estado

    WHEN 'honorarios_pagados'   THEN 'PAGADO'::expediente_estado
    WHEN 'paz_y_salvo_generado' THEN 'PAGADO'::expediente_estado
    WHEN 'caso_finalizado'      THEN 'PAGADO'::expediente_estado

    WHEN 'negado_banco'    THEN 'SIMULADO'::expediente_estado
    WHEN 'prejuridico'     THEN 'FACTURADO'::expediente_estado
    WHEN 'proceso_cerrado' THEN 'SIMULADO'::expediente_estado

    ELSE 'SIMULADO'::expediente_estado
  END;
$function$;

-- Backfill: re-trigger the BEFORE UPDATE sync trigger by touching estado_caso
UPDATE public.expedientes SET estado_caso = estado_caso;
