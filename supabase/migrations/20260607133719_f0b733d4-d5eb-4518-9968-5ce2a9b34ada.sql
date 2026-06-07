-- Trigger function: sync expedientes.estado_caso from validaciones_qa changes
CREATE OR REPLACE FUNCTION public.sync_expediente_qa_estado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_estado public.caso_estado;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Nueva solicitud de validación: marcar como pendiente QA
    IF NEW.resultado IS NULL THEN
      target_estado := 'proyeccion_pendiente_qa';
    ELSIF NEW.resultado = 'aprobada' THEN
      target_estado := 'proyeccion_aprobada_qa';
    ELSIF NEW.resultado = 'devuelta' THEN
      target_estado := 'proyeccion_devuelta_qa';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.resultado IS DISTINCT FROM OLD.resultado THEN
      IF NEW.resultado = 'aprobada' THEN
        target_estado := 'proyeccion_aprobada_qa';
      ELSIF NEW.resultado = 'devuelta' THEN
        target_estado := 'proyeccion_devuelta_qa';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.expedientes
     SET estado_caso = target_estado,
         updated_at = now()
   WHERE id = NEW.expediente_id
     AND estado_caso IS DISTINCT FROM target_estado;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expediente_qa_estado ON public.validaciones_qa;
CREATE TRIGGER trg_sync_expediente_qa_estado
AFTER INSERT OR UPDATE ON public.validaciones_qa
FOR EACH ROW EXECUTE FUNCTION public.sync_expediente_qa_estado();

-- Backfill: sincronizar expedientes existentes con su última validación
WITH ultima AS (
  SELECT DISTINCT ON (expediente_id)
         expediente_id,
         resultado
    FROM public.validaciones_qa
   ORDER BY expediente_id, created_at DESC
)
UPDATE public.expedientes e
   SET estado_caso = CASE
                       WHEN u.resultado IS NULL THEN 'proyeccion_pendiente_qa'::public.caso_estado
                       WHEN u.resultado = 'aprobada' THEN 'proyeccion_aprobada_qa'::public.caso_estado
                       WHEN u.resultado = 'devuelta' THEN 'proyeccion_devuelta_qa'::public.caso_estado
                       ELSE e.estado_caso
                     END,
       updated_at = now()
  FROM ultima u
 WHERE u.expediente_id = e.id
   AND e.estado_caso IS DISTINCT FROM CASE
                       WHEN u.resultado IS NULL THEN 'proyeccion_pendiente_qa'::public.caso_estado
                       WHEN u.resultado = 'aprobada' THEN 'proyeccion_aprobada_qa'::public.caso_estado
                       WHEN u.resultado = 'devuelta' THEN 'proyeccion_devuelta_qa'::public.caso_estado
                       ELSE e.estado_caso
                     END;