
-- Checklist inteligente de documentos por expediente

CREATE TABLE public.expediente_checklist_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  documento_id text NOT NULL,
  documento_nombre text NOT NULL,
  obligatorio boolean NOT NULL DEFAULT true,
  estado text NOT NULL DEFAULT 'pendiente',
  vigencia_dias integer,
  fecha_solicitado timestamptz,
  fecha_recibido timestamptz,
  fecha_vencimiento timestamptz,
  archivo_url text,
  observaciones text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expediente_id, documento_id)
);

CREATE INDEX idx_checklist_docs_expediente ON public.expediente_checklist_documentos(expediente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_checklist_documentos TO authenticated;
GRANT ALL ON public.expediente_checklist_documentos TO service_role;

ALTER TABLE public.expediente_checklist_documentos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_checklist_docs(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role)
      OR public.has_role(_uid,'licenciado'::app_role)
      OR public.has_role(_uid,'operaciones'::app_role)
      OR public.has_role(_uid,'auxiliar_operativo'::app_role)
      OR public.has_role(_uid,'juridica'::app_role)
      OR public.has_role(_uid,'director_juridico'::app_role);
$$;

CREATE POLICY "checklist docs select" ON public.expediente_checklist_documentos
  FOR SELECT TO authenticated USING (public.can_use_checklist_docs(auth.uid()));
CREATE POLICY "checklist docs insert" ON public.expediente_checklist_documentos
  FOR INSERT TO authenticated WITH CHECK (public.can_use_checklist_docs(auth.uid()));
CREATE POLICY "checklist docs update" ON public.expediente_checklist_documentos
  FOR UPDATE TO authenticated USING (public.can_use_checklist_docs(auth.uid()));
CREATE POLICY "checklist docs delete" ON public.expediente_checklist_documentos
  FOR DELETE TO authenticated USING (public.can_use_checklist_docs(auth.uid()));

CREATE TRIGGER trg_checklist_docs_updated
BEFORE UPDATE ON public.expediente_checklist_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.expediente_checklist_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  enviado_a_email text NOT NULL,
  cc_licenciado_email text,
  asunto text NOT NULL,
  cuerpo text NOT NULL,
  pdf_url text,
  enviado_por uuid,
  enviado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_envios_expediente ON public.expediente_checklist_envios(expediente_id);

GRANT SELECT, INSERT ON public.expediente_checklist_envios TO authenticated;
GRANT ALL ON public.expediente_checklist_envios TO service_role;

ALTER TABLE public.expediente_checklist_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist envios select" ON public.expediente_checklist_envios
  FOR SELECT TO authenticated USING (public.can_use_checklist_docs(auth.uid()));
CREATE POLICY "checklist envios insert" ON public.expediente_checklist_envios
  FOR INSERT TO authenticated WITH CHECK (public.can_use_checklist_docs(auth.uid()));
