
-- ENUMs
CREATE TYPE public.qa_modalidad AS ENUM ('hipotecario','leasing','uvr');
CREATE TYPE public.qa_categoria AS ENUM ('excelente','aprobado','revisar','rechazado');
CREATE TYPE public.qa_dictamen AS ENUM ('aprobado','aprobado_obs','requiere_revision','rechazado');
CREATE TYPE public.qa_severidad AS ENUM ('info','warning','critica');
CREATE TYPE public.qa_inconsistencia_tipo AS ENUM ('tasa','seguros','cuota','frech','uvr','flujo','simulacion','extracto','honorario','plazo','saldo');
CREATE TYPE public.qa_alerta_estado AS ENUM ('abierta','reconocida','resuelta');
CREATE TYPE public.qa_regla_tipo AS ENUM ('tolerancia','umbral','penalizacion');
CREATE TYPE public.qa_log_accion AS ENUM ('crear','recalcular','reconocer_alerta','cerrar','exportar');

-- Helper de acceso QA
CREATE OR REPLACE FUNCTION public.can_use_qa_ai(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role)
      OR public.has_role(_uid,'director_financiero_qa'::app_role);
$$;

-- qa_auditorias
CREATE TABLE public.qa_auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid REFERENCES public.expedientes(id) ON DELETE SET NULL,
  analista_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  simulacion_id uuid REFERENCES public.audit_simulaciones(id) ON DELETE SET NULL,
  extracto_id uuid REFERENCES public.extractos_lecturas(id) ON DELETE SET NULL,
  modalidad public.qa_modalidad NOT NULL,
  motor_version text NOT NULL DEFAULT '1.0.0',
  qa_score numeric(5,2) NOT NULL DEFAULT 0,
  categoria public.qa_categoria NOT NULL,
  dictamen public.qa_dictamen NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  diferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ejecutado_at timestamptz NOT NULL DEFAULT now(),
  ejecutado_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_auditorias TO authenticated;
GRANT ALL ON public.qa_auditorias TO service_role;
ALTER TABLE public.qa_auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_auditorias_select" ON public.qa_auditorias FOR SELECT TO authenticated
  USING (public.can_use_qa_ai(auth.uid())
      OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND e.asesor_id = auth.uid()));
CREATE POLICY "qa_auditorias_write" ON public.qa_auditorias FOR ALL TO authenticated
  USING (public.can_use_qa_ai(auth.uid()))
  WITH CHECK (public.can_use_qa_ai(auth.uid()));
CREATE TRIGGER trg_qa_auditorias_updated BEFORE UPDATE ON public.qa_auditorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_qa_auditorias_expediente ON public.qa_auditorias(expediente_id);
CREATE INDEX idx_qa_auditorias_analista ON public.qa_auditorias(analista_id);
CREATE INDEX idx_qa_auditorias_ejecutado_at ON public.qa_auditorias(ejecutado_at DESC);

-- qa_inconsistencias
CREATE TABLE public.qa_inconsistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.qa_auditorias(id) ON DELETE CASCADE,
  tipo public.qa_inconsistencia_tipo NOT NULL,
  severidad public.qa_severidad NOT NULL,
  campo text,
  valor_extracto numeric,
  valor_calculado numeric,
  diferencia numeric,
  mensaje text NOT NULL,
  sugerencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_inconsistencias TO authenticated;
GRANT ALL ON public.qa_inconsistencias TO service_role;
ALTER TABLE public.qa_inconsistencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_inconsistencias_select" ON public.qa_inconsistencias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_auditorias a WHERE a.id = auditoria_id
    AND (public.can_use_qa_ai(auth.uid())
      OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = a.expediente_id AND e.asesor_id = auth.uid()))));
CREATE POLICY "qa_inconsistencias_write" ON public.qa_inconsistencias FOR ALL TO authenticated
  USING (public.can_use_qa_ai(auth.uid()))
  WITH CHECK (public.can_use_qa_ai(auth.uid()));
CREATE INDEX idx_qa_inconsistencias_auditoria ON public.qa_inconsistencias(auditoria_id);

-- qa_alertas
CREATE TABLE public.qa_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.qa_auditorias(id) ON DELETE CASCADE,
  expediente_id uuid REFERENCES public.expedientes(id) ON DELETE SET NULL,
  tipo public.qa_inconsistencia_tipo NOT NULL,
  severidad public.qa_severidad NOT NULL,
  mensaje text NOT NULL,
  estado public.qa_alerta_estado NOT NULL DEFAULT 'abierta',
  reconocida_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reconocida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_alertas TO authenticated;
GRANT ALL ON public.qa_alertas TO service_role;
ALTER TABLE public.qa_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_alertas_select" ON public.qa_alertas FOR SELECT TO authenticated
  USING (public.can_use_qa_ai(auth.uid())
      OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND e.asesor_id = auth.uid()));
CREATE POLICY "qa_alertas_write" ON public.qa_alertas FOR ALL TO authenticated
  USING (public.can_use_qa_ai(auth.uid()))
  WITH CHECK (public.can_use_qa_ai(auth.uid()));
CREATE TRIGGER trg_qa_alertas_updated BEFORE UPDATE ON public.qa_alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_qa_alertas_estado ON public.qa_alertas(estado);
CREATE INDEX idx_qa_alertas_expediente ON public.qa_alertas(expediente_id);

-- qa_reglas
CREATE TABLE public.qa_reglas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descripcion text NOT NULL,
  tipo public.qa_regla_tipo NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  activa boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_reglas TO authenticated;
GRANT ALL ON public.qa_reglas TO service_role;
ALTER TABLE public.qa_reglas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_reglas_select" ON public.qa_reglas FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_reglas_write" ON public.qa_reglas FOR ALL TO authenticated
  USING (public.can_use_qa_ai(auth.uid()))
  WITH CHECK (public.can_use_qa_ai(auth.uid()));
CREATE TRIGGER trg_qa_reglas_updated BEFORE UPDATE ON public.qa_reglas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- qa_auditoria_log (append-only)
CREATE TABLE public.qa_auditoria_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.qa_auditorias(id) ON DELETE CASCADE,
  accion public.qa_log_accion NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.qa_auditoria_log TO authenticated;
GRANT ALL ON public.qa_auditoria_log TO service_role;
ALTER TABLE public.qa_auditoria_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_log_select" ON public.qa_auditoria_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_auditorias a WHERE a.id = auditoria_id
    AND (public.can_use_qa_ai(auth.uid())
      OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = a.expediente_id AND e.asesor_id = auth.uid()))));
CREATE POLICY "qa_log_insert" ON public.qa_auditoria_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_qa_log_auditoria ON public.qa_auditoria_log(auditoria_id);

-- Semilla de reglas por defecto
INSERT INTO public.qa_reglas (codigo, descripcion, tipo, payload) VALUES
  ('tol.cuota',        'Tolerancia cuota mensual',         'tolerancia',   '{"pct":0.5,"abs":5000}'::jsonb),
  ('tol.saldo',        'Tolerancia saldo capital',         'tolerancia',   '{"pct":0.1,"abs":10000}'::jsonb),
  ('tol.tasa_ea',      'Tolerancia tasa EA (pp)',          'tolerancia',   '{"abs":0.05}'::jsonb),
  ('tol.seguros',      'Tolerancia total seguros',         'tolerancia',   '{"abs":2000}'::jsonb),
  ('tol.frech',        'Tolerancia cobertura FRECH (pp)',  'tolerancia',   '{"abs":0.10}'::jsonb),
  ('umb.sim_cuotas',   'Umbral diferencia cuotas eliminadas (sim)', 'umbral', '{"max":2}'::jsonb),
  ('umb.sim_ahorro',   'Umbral diferencia ahorro proyectado (COP)', 'umbral', '{"abs":500000}'::jsonb),
  ('umb.score.excelente', 'Score mínimo EXCELENTE',        'umbral',       '{"min":95}'::jsonb),
  ('umb.score.aprobado',  'Score mínimo APROBADO',         'umbral',       '{"min":85}'::jsonb),
  ('umb.score.revisar',   'Score mínimo REVISAR',          'umbral',       '{"min":70}'::jsonb),
  ('pen.info',         'Penalización por inconsistencia info',     'penalizacion', '{"value":1}'::jsonb),
  ('pen.warning',      'Penalización por inconsistencia warning',  'penalizacion', '{"value":5}'::jsonb),
  ('pen.critica',      'Penalización por inconsistencia crítica',  'penalizacion', '{"value":15}'::jsonb),
  ('pen.diff_cuota',   'Penalización máxima por diferencia cuota', 'penalizacion', '{"max":10}'::jsonb),
  ('pen.diff_sim',     'Penalización máxima por diferencia simulación', 'penalizacion', '{"max":25}'::jsonb),
  ('pen.faltantes',    'Penalización máxima por campos faltantes', 'penalizacion', '{"max":10}'::jsonb);
