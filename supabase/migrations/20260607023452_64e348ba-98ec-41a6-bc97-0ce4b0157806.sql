
-- ============================================================
-- ETAPA A: Audit Engine + Licencia de Autonomía
-- ============================================================

-- Helper: trigger updated_at (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ------------------------------------------------------------
-- 1) audit_simulaciones
-- ------------------------------------------------------------
CREATE TABLE public.audit_simulaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analista_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  banco TEXT,
  producto TEXT,
  tipo_credito TEXT,
  moneda TEXT CHECK (moneda IN ('pesos','uvr')),
  datos_extracto JSONB NOT NULL DEFAULT '{}'::jsonb,
  datos_analista JSONB NOT NULL DEFAULT '{}'::jsonb,
  datos_propuesta JSONB NOT NULL DEFAULT '{}'::jsonb,
  inconsistencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_extracto INTEGER NOT NULL DEFAULT 0,
  score_matematico INTEGER NOT NULL DEFAULT 0,
  score_campos INTEGER NOT NULL DEFAULT 0,
  score_documental INTEGER NOT NULL DEFAULT 0,
  score_total INTEGER NOT NULL DEFAULT 0,
  nivel_riesgo TEXT NOT NULL DEFAULT 'escalar' CHECK (nivel_riesgo IN ('apto','revisar','escalar')),
  requiere_revision BOOLEAN NOT NULL DEFAULT true,
  motivo_escalamiento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_simulaciones_analista ON public.audit_simulaciones(analista_id);
CREATE INDEX idx_audit_simulaciones_expediente ON public.audit_simulaciones(expediente_id);
CREATE INDEX idx_audit_simulaciones_riesgo ON public.audit_simulaciones(nivel_riesgo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_simulaciones TO authenticated;
GRANT ALL ON public.audit_simulaciones TO service_role;
ALTER TABLE public.audit_simulaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analista ve sus simulaciones"
  ON public.audit_simulaciones FOR SELECT TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerencia')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
CREATE POLICY "Analista crea sus simulaciones"
  ON public.audit_simulaciones FOR INSERT TO authenticated
  WITH CHECK (analista_id = auth.uid());
CREATE POLICY "Analista actualiza sus simulaciones"
  ON public.audit_simulaciones FOR UPDATE TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
CREATE POLICY "Gerencia elimina simulaciones"
  ON public.audit_simulaciones FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
  );

CREATE TRIGGER trg_audit_simulaciones_updated
  BEFORE UPDATE ON public.audit_simulaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2) audit_respuestas_banco
-- ------------------------------------------------------------
CREATE TABLE public.audit_respuestas_banco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulacion_id UUID NOT NULL REFERENCES public.audit_simulaciones(id) ON DELETE CASCADE,
  analista_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuota_propuesta NUMERIC(18,2),
  plazo_propuesto INTEGER,
  cuotas_eliminadas_propuestas INTEGER,
  cuota_aprobada NUMERIC(18,2),
  plazo_aprobado INTEGER,
  cuotas_aprobadas INTEGER,
  fecha_aprobacion DATE,
  observaciones TEXT,
  precision_cuota NUMERIC(5,2),
  precision_plazo NUMERIC(5,2),
  precision_ahorro NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_respuestas_simulacion ON public.audit_respuestas_banco(simulacion_id);
CREATE INDEX idx_audit_respuestas_analista ON public.audit_respuestas_banco(analista_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_respuestas_banco TO authenticated;
GRANT ALL ON public.audit_respuestas_banco TO service_role;
ALTER TABLE public.audit_respuestas_banco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver respuestas banco"
  ON public.audit_respuestas_banco FOR SELECT TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerencia')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
CREATE POLICY "Crear respuestas banco"
  ON public.audit_respuestas_banco FOR INSERT TO authenticated
  WITH CHECK (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
CREATE POLICY "Actualizar respuestas banco"
  ON public.audit_respuestas_banco FOR UPDATE TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );

CREATE TRIGGER trg_audit_respuestas_updated
  BEFORE UPDATE ON public.audit_respuestas_banco
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3) analista_metricas
-- ------------------------------------------------------------
CREATE TABLE public.analista_metricas (
  analista_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_simulaciones INTEGER NOT NULL DEFAULT 0,
  score_promedio NUMERIC(5,2) NOT NULL DEFAULT 0,
  precision_historica NUMERIC(5,2) NOT NULL DEFAULT 0,
  porcentaje_devoluciones NUMERIC(5,2) NOT NULL DEFAULT 0,
  porcentaje_aprobacion_banco NUMERIC(5,2) NOT NULL DEFAULT 0,
  nivel_autonomia INTEGER NOT NULL DEFAULT 1 CHECK (nivel_autonomia IN (1,2,3)),
  ultimo_recalculo TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.analista_metricas TO authenticated;
GRANT ALL ON public.analista_metricas TO service_role;
ALTER TABLE public.analista_metricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mis metricas o gerencia ve todo"
  ON public.analista_metricas FOR SELECT TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerencia')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );

CREATE TRIGGER trg_analista_metricas_updated
  BEFORE UPDATE ON public.analista_metricas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 4) audit_alertas
-- ------------------------------------------------------------
CREATE TABLE public.audit_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analista_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulacion_id UUID REFERENCES public.audit_simulaciones(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cambio_nivel','escalamiento','devolucion','reconocimiento')),
  nivel_anterior INTEGER,
  nivel_nuevo INTEGER,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_alertas_analista ON public.audit_alertas(analista_id);
CREATE INDEX idx_audit_alertas_tipo ON public.audit_alertas(tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_alertas TO authenticated;
GRANT ALL ON public.audit_alertas TO service_role;
ALTER TABLE public.audit_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver alertas propias o gerencia"
  ON public.audit_alertas FOR SELECT TO authenticated
  USING (
    analista_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerencia')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
CREATE POLICY "Marcar alertas leidas"
  ON public.audit_alertas FOR UPDATE TO authenticated
  USING (analista_id = auth.uid());
CREATE POLICY "Gerencia crea alertas manuales"
  ON public.audit_alertas FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director_financiero_qa')
  );
