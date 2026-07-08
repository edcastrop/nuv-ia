
ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS propuesta_exportada_at timestamptz,
  ADD COLUMN IF NOT EXISTS propuesta_exportada_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_generado_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_generado_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS propuesta_email_enviada_at timestamptz,
  ADD COLUMN IF NOT EXISTS propuesta_email_enviada_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qa_auditoria_origen_id uuid REFERENCES public.qa_auditorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_qa_origen ON public.expedientes(qa_auditoria_origen_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_propuesta_lista
  ON public.expedientes(propuesta_exportada_at, whatsapp_generado_at)
  WHERE propuesta_exportada_at IS NOT NULL AND whatsapp_generado_at IS NOT NULL;

-- RPC: promueve una QA huérfana a expediente (E1 → cuando se crea, ya deja de ser huérfano)
CREATE OR REPLACE FUNCTION public.promover_qa_a_expediente(_qa_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qa RECORD;
  _exp_id uuid;
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, analista_id, cliente_nombre, banco, producto, expediente_id
    INTO _qa
    FROM public.qa_auditorias
   WHERE id = _qa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auditoría QA no encontrada';
  END IF;

  IF _qa.expediente_id IS NOT NULL THEN
    RETURN _qa.expediente_id;
  END IF;

  IF _qa.cliente_nombre IS NULL OR btrim(_qa.cliente_nombre) = '' THEN
    RAISE EXCEPTION 'La auditoría no tiene cliente_nombre; no se puede promover';
  END IF;

  INSERT INTO public.expedientes (
    asesor_id, modo, cliente_nombre, banco, producto,
    estado, qa_auditoria_origen_id
  ) VALUES (
    COALESCE(_qa.analista_id, _caller),
    'pesos',
    _qa.cliente_nombre,
    _qa.banco,
    _qa.producto,
    'SIMULADO',
    _qa.id
  )
  RETURNING id INTO _exp_id;

  UPDATE public.qa_auditorias SET expediente_id = _exp_id WHERE id = _qa.id;

  RETURN _exp_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promover_qa_a_expediente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promover_qa_a_expediente(uuid) TO authenticated;
