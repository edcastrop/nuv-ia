
-- =====================================================
-- NUVIA Command Center — Fase 7.5
-- =====================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.goal_nivel AS ENUM ('empresa', 'area', 'persona');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_tipo AS ENUM (
    'honorarios', 'ahorro', 'casos_cerrados', 'conversion', 'cartera_recuperada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.health_estado AS ENUM (
    'excelente', 'saludable', 'atencion', 'riesgo', 'critico'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: ¿caller es ejecutivo NUVIA?
CREATE OR REPLACE FUNCTION public.is_command_center_executive(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'gerencia', 'director_financiero_qa', 'director_juridico')
  )
$$;

-- =====================================================
-- 1) monthly_goals — metas corporativas (empresa/área/persona)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL,                       -- primer día del mes
  nivel public.goal_nivel NOT NULL,
  area text,                                    -- requerido si nivel='area' o 'persona'
  responsable_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo public.goal_tipo NOT NULL,
  valor_meta numeric NOT NULL CHECK (valor_meta >= 0),
  unidad text NOT NULL DEFAULT 'COP',
  notas text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validaciones de coherencia nivel/area/responsable
CREATE OR REPLACE FUNCTION public.monthly_goals_validate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nivel = 'empresa' THEN
    IF NEW.area IS NOT NULL OR NEW.responsable_id IS NOT NULL THEN
      RAISE EXCEPTION 'Meta nivel empresa no admite area ni responsable_id';
    END IF;
  ELSIF NEW.nivel = 'area' THEN
    IF NEW.area IS NULL OR NEW.responsable_id IS NOT NULL THEN
      RAISE EXCEPTION 'Meta nivel area requiere area y no admite responsable_id';
    END IF;
  ELSIF NEW.nivel = 'persona' THEN
    IF NEW.area IS NULL OR NEW.responsable_id IS NULL THEN
      RAISE EXCEPTION 'Meta nivel persona requiere area y responsable_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER monthly_goals_validate_trg
BEFORE INSERT OR UPDATE ON public.monthly_goals
FOR EACH ROW EXECUTE FUNCTION public.monthly_goals_validate();

-- Unicidad por nivel
CREATE UNIQUE INDEX IF NOT EXISTS monthly_goals_empresa_uq
  ON public.monthly_goals (periodo, tipo)
  WHERE nivel = 'empresa';
CREATE UNIQUE INDEX IF NOT EXISTS monthly_goals_area_uq
  ON public.monthly_goals (periodo, tipo, area)
  WHERE nivel = 'area';
CREATE UNIQUE INDEX IF NOT EXISTS monthly_goals_persona_uq
  ON public.monthly_goals (periodo, tipo, responsable_id)
  WHERE nivel = 'persona';

CREATE INDEX IF NOT EXISTS monthly_goals_periodo_idx ON public.monthly_goals (periodo);
CREATE INDEX IF NOT EXISTS monthly_goals_responsable_idx ON public.monthly_goals (responsable_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_goals TO authenticated;
GRANT ALL ON public.monthly_goals TO service_role;

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- SELECT: ejecutivos ven todo; persona ve sus metas personales
CREATE POLICY "goals_select_executive"
  ON public.monthly_goals FOR SELECT
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

CREATE POLICY "goals_select_own_personal"
  ON public.monthly_goals FOR SELECT
  TO authenticated
  USING (nivel = 'persona' AND responsable_id = auth.uid());

-- INSERT/UPDATE/DELETE: solo ejecutivos
CREATE POLICY "goals_modify_executive_insert"
  ON public.monthly_goals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_command_center_executive(auth.uid()));

CREATE POLICY "goals_modify_executive_update"
  ON public.monthly_goals FOR UPDATE
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()))
  WITH CHECK (public.is_command_center_executive(auth.uid()));

CREATE POLICY "goals_modify_executive_delete"
  ON public.monthly_goals FOR DELETE
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

-- =====================================================
-- 2) scoreboard_snapshot_daily — ranking por persona (materializado)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scoreboard_snapshot_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  area text NOT NULL,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kpis_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  posicion int NOT NULL,
  percentil int NOT NULL CHECK (percentil >= 0 AND percentil <= 100),
  promedio_area numeric,
  tendencia text CHECK (tendencia IN ('mejora', 'estable', 'deterioro')),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha, area, usuario_id)
);

CREATE INDEX IF NOT EXISTS scoreboard_fecha_area_idx
  ON public.scoreboard_snapshot_daily (fecha, area, score DESC);
CREATE INDEX IF NOT EXISTS scoreboard_usuario_fecha_idx
  ON public.scoreboard_snapshot_daily (usuario_id, fecha DESC);

GRANT SELECT ON public.scoreboard_snapshot_daily TO authenticated;
GRANT ALL ON public.scoreboard_snapshot_daily TO service_role;

ALTER TABLE public.scoreboard_snapshot_daily ENABLE ROW LEVEL SECURITY;

-- Ejecutivos: ranking nominal completo
CREATE POLICY "scoreboard_select_executive"
  ON public.scoreboard_snapshot_daily FOR SELECT
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

-- Resto: solo su propia fila (la anonimización agregada va por serverFn)
CREATE POLICY "scoreboard_select_own"
  ON public.scoreboard_snapshot_daily FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- =====================================================
-- 3) health_score_daily — Health Score NUVEX
-- =====================================================
CREATE TABLE IF NOT EXISTS public.health_score_daily (
  fecha date PRIMARY KEY,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  componentes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {produccion, conversion, cartera, sla, actividad} → 0-100 c/u
  estado public.health_estado NOT NULL,
  tendencia text CHECK (tendencia IN ('mejora', 'estable', 'deterioro')),
  calculated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.health_score_daily TO authenticated;
GRANT ALL ON public.health_score_daily TO service_role;

ALTER TABLE public.health_score_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_score_select_executive"
  ON public.health_score_daily FOR SELECT
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

-- =====================================================
-- 4) executive_metrics_daily — métricas ejecutivas materializadas
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_metrics_daily (
  fecha date PRIMARY KEY,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { honorarios_mtd, honorarios_proyectado, ahorro_mtd, ahorro_proyectado,
  --   casos_activos, casos_cerrados_mtd, conversion_mtd,
  --   cartera_total, cartera_recuperada_mtd, productividad_areas, funnel, aging }
  calculated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.executive_metrics_daily TO authenticated;
GRANT ALL ON public.executive_metrics_daily TO service_role;

ALTER TABLE public.executive_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executive_metrics_select_executive"
  ON public.executive_metrics_daily FOR SELECT
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

-- =====================================================
-- 5) executive_copilot_log — bitácora IA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_copilot_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  contexto_json jsonb NOT NULL DEFAULT '{}'::jsonb,   -- snapshot agregado, sin PII
  recomendaciones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  modelo text,
  tokens_input int,
  tokens_output int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_log_usuario_idx
  ON public.executive_copilot_log (usuario_id, created_at DESC);

GRANT SELECT, INSERT ON public.executive_copilot_log TO authenticated;
GRANT ALL ON public.executive_copilot_log TO service_role;

ALTER TABLE public.executive_copilot_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_log_select_executive"
  ON public.executive_copilot_log FOR SELECT
  TO authenticated
  USING (public.is_command_center_executive(auth.uid()));

CREATE POLICY "copilot_log_select_own"
  ON public.executive_copilot_log FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "copilot_log_insert_own"
  ON public.executive_copilot_log FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- =====================================================
-- Trigger updated_at para monthly_goals
-- =====================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_goals_touch_updated_at ON public.monthly_goals;
CREATE TRIGGER monthly_goals_touch_updated_at
BEFORE UPDATE ON public.monthly_goals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
