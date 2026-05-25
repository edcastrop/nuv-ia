
-- Función de mapeo caso.estado -> expediente.estado
CREATE OR REPLACE FUNCTION public.map_caso_to_expediente_estado(_caso caso_estado)
RETURNS expediente_estado
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
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

    -- Contratación enviada → ENVIADO_CONTRATACION
    WHEN 'enviado_contratacion'     THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_enviado'         THEN 'ENVIADO_CONTRATACION'::expediente_estado
    WHEN 'contrato_generado'        THEN 'ENVIADO_CONTRATACION'::expediente_estado

    -- Firmado / listo para radicar → FIRMADO
    WHEN 'contrato_firmado'         THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_generado'           THEN 'FIRMADO'::expediente_estado
    WHEN 'poder_firmado'            THEN 'FIRMADO'::expediente_estado
    WHEN 'documentacion_completa'   THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_pendiente'     THEN 'FIRMADO'::expediente_estado
    WHEN 'radicacion_preparada'     THEN 'FIRMADO'::expediente_estado

    -- En banco → RADICADO
    WHEN 'radicado_banco'             THEN 'RADICADO'::expediente_estado
    WHEN 'en_estudio_banco'           THEN 'RADICADO'::expediente_estado
    WHEN 'docs_complementarios_banco' THEN 'RADICADO'::expediente_estado
    WHEN 'devuelto_banco'             THEN 'RADICADO'::expediente_estado

    -- Aprobado por banco → APROBADO
    WHEN 'aprobado'                   THEN 'APROBADO'::expediente_estado
    WHEN 'aprobado_banco'             THEN 'APROBADO'::expediente_estado
    WHEN 'documentos_banco_firmados'  THEN 'APROBADO'::expediente_estado
    WHEN 'condiciones_aplicadas'      THEN 'APROBADO'::expediente_estado
    WHEN 'aplicado_banco'             THEN 'APROBADO'::expediente_estado
    WHEN 'resultado_final_generado'   THEN 'APROBADO'::expediente_estado

    -- Cuenta de cobro / facturación → FACTURADO
    WHEN 'cuenta_cobro_generada'  THEN 'FACTURADO'::expediente_estado
    WHEN 'cuenta_cobro_enviada'   THEN 'FACTURADO'::expediente_estado
    WHEN 'honorarios_pendientes'  THEN 'FACTURADO'::expediente_estado

    -- Pago confirmado → PAGADO
    WHEN 'honorarios_pagados'   THEN 'PAGADO'::expediente_estado
    WHEN 'paz_y_salvo_generado' THEN 'PAGADO'::expediente_estado
    WHEN 'caso_finalizado'      THEN 'PAGADO'::expediente_estado

    -- Casos negativos: mantener SIMULADO como neutro
    WHEN 'negado_banco'    THEN 'SIMULADO'::expediente_estado
    WHEN 'prejuridico'     THEN 'FACTURADO'::expediente_estado
    WHEN 'proceso_cerrado' THEN 'SIMULADO'::expediente_estado

    ELSE 'SIMULADO'::expediente_estado
  END;
$$;

-- Trigger: cada vez que cambia estado_caso, sincroniza estado del expediente
CREATE OR REPLACE FUNCTION public.sync_expediente_estado_from_caso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target expediente_estado;
BEGIN
  v_target := public.map_caso_to_expediente_estado(NEW.estado_caso);
  IF NEW.estado IS DISTINCT FROM v_target THEN
    NEW.estado := v_target;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expediente_estado ON public.expedientes;
CREATE TRIGGER trg_sync_expediente_estado
BEFORE INSERT OR UPDATE OF estado_caso ON public.expedientes
FOR EACH ROW
EXECUTE FUNCTION public.sync_expediente_estado_from_caso();

-- Backfill: reconciliar todos los expedientes existentes
UPDATE public.expedientes
SET estado = public.map_caso_to_expediente_estado(estado_caso)
WHERE estado IS DISTINCT FROM public.map_caso_to_expediente_estado(estado_caso);
