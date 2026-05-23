-- 1) Nuevo estado del ciclo del expediente
ALTER TYPE public.expediente_estado ADD VALUE IF NOT EXISTS 'ENVIADO_CONTRATACION';

-- 2) Destinatarios configurables
CREATE TABLE IF NOT EXISTS public.contratacion_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nombre text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratacion_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Destinatarios visibles autenticados"
  ON public.contratacion_destinatarios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Destinatarios insert admin/gerencia"
  ON public.contratacion_destinatarios FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

CREATE POLICY "Destinatarios update admin/gerencia"
  ON public.contratacion_destinatarios FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

CREATE POLICY "Destinatarios delete admin/gerencia"
  ON public.contratacion_destinatarios FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

CREATE TRIGGER trg_destinatarios_updated_at
  BEFORE UPDATE ON public.contratacion_destinatarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.contratacion_destinatarios (email, nombre, activo)
VALUES ('contratacion@nuvex.com.co', 'Contratación NUVEX', true)
ON CONFLICT (email) DO NOTHING;

-- 3) Trazabilidad de envíos
CREATE TABLE IF NOT EXISTS public.envios_contratacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  destinatarios text[] NOT NULL DEFAULT '{}',
  asunto text NOT NULL,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado_envio text NOT NULL DEFAULT 'enviado',
  proveedor_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envios_contratacion_exp ON public.envios_contratacion(expediente_id);

ALTER TABLE public.envios_contratacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envios visibles si expediente visible"
  ON public.envios_contratacion FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = envios_contratacion.expediente_id
      AND (e.asesor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role))
  ));

CREATE POLICY "Envios insert por owner"
  ON public.envios_contratacion FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = envios_contratacion.expediente_id
      AND (e.asesor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role))
  ));