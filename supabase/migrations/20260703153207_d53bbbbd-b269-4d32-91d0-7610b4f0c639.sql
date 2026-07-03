
-- 1) Añadir columnas de certificación a audit_simulaciones
ALTER TABLE public.audit_simulaciones
  ADD COLUMN IF NOT EXISTS certificado_nuvia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hash_calculo text;

CREATE INDEX IF NOT EXISTS idx_audit_simulaciones_certificado
  ON public.audit_simulaciones(certificado_nuvia)
  WHERE certificado_nuvia = true;

-- 2) Nueva tabla consultas_tecnicas (escalación a Dirección Financiera sin crear caso)
CREATE TABLE IF NOT EXISTS public.consultas_tecnicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  director_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_revision','aprobada','aprobada_con_excepcion','rechazada','devuelta')),
  banco text,
  producto text,
  tipo_credito text,
  moneda text,
  snapshot_simulacion jsonb NOT NULL,
  hallazgos_nuvia jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas_analista text,
  dictamen_director text,
  ajustes_sugeridos jsonb,
  restore_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  restored_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultas_tecnicas TO authenticated;
GRANT ALL ON public.consultas_tecnicas TO service_role;

ALTER TABLE public.consultas_tecnicas ENABLE ROW LEVEL SECURITY;

-- Analista: ve y crea sus propias consultas
CREATE POLICY "analista_ve_sus_consultas"
  ON public.consultas_tecnicas FOR SELECT
  TO authenticated
  USING (analista_id = auth.uid());

CREATE POLICY "analista_crea_consulta"
  ON public.consultas_tecnicas FOR INSERT
  TO authenticated
  WITH CHECK (analista_id = auth.uid());

-- Analista: puede actualizar restored_at cuando reanuda su consulta
CREATE POLICY "analista_actualiza_su_consulta"
  ON public.consultas_tecnicas FOR UPDATE
  TO authenticated
  USING (analista_id = auth.uid())
  WITH CHECK (analista_id = auth.uid());

-- Director financiero / super_admin / gerencia: ve y resuelve todas
CREATE POLICY "director_ve_consultas"
  ON public.consultas_tecnicas FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'director_financiero_qa')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );

CREATE POLICY "director_resuelve_consultas"
  ON public.consultas_tecnicas FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'director_financiero_qa')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'director_financiero_qa')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
  );

-- Trigger updated_at
CREATE TRIGGER trg_consultas_tecnicas_updated_at
  BEFORE UPDATE ON public.consultas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_consultas_tecnicas_analista ON public.consultas_tecnicas(analista_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_tecnicas_estado ON public.consultas_tecnicas(estado, created_at DESC);
