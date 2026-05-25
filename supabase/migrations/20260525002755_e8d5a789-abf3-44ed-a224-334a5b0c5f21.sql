
-- 1. Extend caso_estado enum with new V2 values (idempotent)
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'simulado';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'prospecto';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'propuesta_enviada';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'acepto_propuesta';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'documentacion_completa';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'contrato_generado';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'poder_generado';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'radicacion_preparada';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'aprobado_banco';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'docs_complementarios_banco';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'aplicado_banco';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'honorarios_pendientes';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'caso_finalizado';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'devuelto_banco';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'negado_banco';

-- 2. caso_submotivos
CREATE TABLE IF NOT EXISTS public.caso_submotivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL,
  estado TEXT NOT NULL,
  submotivo TEXT NOT NULL,
  observacion TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caso_submotivos_exp ON public.caso_submotivos(expediente_id);

ALTER TABLE public.caso_submotivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submotivos select por owner/manager"
  ON public.caso_submotivos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = caso_submotivos.expediente_id
      AND (e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role))
  ));

CREATE POLICY "Submotivos insert por owner/manager"
  ON public.caso_submotivos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = caso_submotivos.expediente_id
      AND (e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role))
  ));

-- 3. caso_alertas
CREATE TABLE IF NOT EXISTS public.caso_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  dias_estancado INTEGER NOT NULL DEFAULT 0,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caso_alertas_exp ON public.caso_alertas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_caso_alertas_leida ON public.caso_alertas(leida) WHERE leida = false;

ALTER TABLE public.caso_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertas select por owner/manager"
  ON public.caso_alertas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = caso_alertas.expediente_id
      AND (e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role))
  ));

CREATE POLICY "Alertas insert por manager"
  ON public.caso_alertas FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gerencia'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Alertas update marcar leida por owner/manager"
  ON public.caso_alertas FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.expedientes e
    WHERE e.id = caso_alertas.expediente_id
      AND (e.asesor_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerencia'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role))
  ));

CREATE POLICY "Alertas delete super admin"
  ON public.caso_alertas FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));
