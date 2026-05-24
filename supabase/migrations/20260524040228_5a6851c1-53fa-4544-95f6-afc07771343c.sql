CREATE TABLE public.extractos_lecturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NULL,
  asesor_id uuid NOT NULL DEFAULT auth.uid(),
  aprobado_por uuid NULL,
  banco text NULL,
  producto text NULL,
  moneda text NULL,
  archivo_path text NULL,
  archivo_nombre text NULL,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  confianza_global numeric(5,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'borrador',
  motor_version text NOT NULL DEFAULT 'v1',
  notas text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extractos_lecturas_asesor ON public.extractos_lecturas(asesor_id);
CREATE INDEX idx_extractos_lecturas_expediente ON public.extractos_lecturas(expediente_id);

ALTER TABLE public.extractos_lecturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecturas select por owner o manager"
ON public.extractos_lecturas FOR SELECT TO authenticated
USING (
  asesor_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
);

CREATE POLICY "Lecturas insert por owner"
ON public.extractos_lecturas FOR INSERT TO authenticated
WITH CHECK (asesor_id = auth.uid());

CREATE POLICY "Lecturas update por owner o manager"
ON public.extractos_lecturas FOR UPDATE TO authenticated
USING (
  asesor_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
);

CREATE POLICY "Lecturas delete por owner o manager"
ON public.extractos_lecturas FOR DELETE TO authenticated
USING (
  asesor_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE TRIGGER trg_extractos_lecturas_updated_at
BEFORE UPDATE ON public.extractos_lecturas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();