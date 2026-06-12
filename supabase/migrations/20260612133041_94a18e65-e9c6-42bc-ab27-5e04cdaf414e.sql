
-- ============== ENUMS ==============
CREATE TYPE public.treasury_extracto_estado AS ENUM ('procesando','listo','error');
CREATE TYPE public.treasury_mov_tipo AS ENUM ('credito','debito');
CREATE TYPE public.treasury_mov_estado AS ENUM ('no_identificado','sugerido','conciliado','descartado');
CREATE TYPE public.treasury_match_tipo AS ENUM ('cartera','cuenta_cobro','honorario','comision','otro');

-- ============== treasury_bancos ==============
CREATE TABLE public.treasury_bancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  alias text,
  tipo_cuenta text,
  numero_cuenta text,
  moneda text NOT NULL DEFAULT 'COP',
  saldo_actual numeric(18,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  parser_profile text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_bancos TO authenticated;
GRANT ALL ON public.treasury_bancos TO service_role;
ALTER TABLE public.treasury_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_bancos_all ON public.treasury_bancos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER tg_treasury_bancos_upd BEFORE UPDATE ON public.treasury_bancos
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============== treasury_extractos ==============
CREATE TABLE public.treasury_extractos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_id uuid REFERENCES public.treasury_bancos(id) ON DELETE SET NULL,
  archivo_url text,
  archivo_nombre text,
  formato text NOT NULL,
  periodo_inicio date,
  periodo_fin date,
  total_movs integer NOT NULL DEFAULT 0,
  total_ingresos numeric(18,2) NOT NULL DEFAULT 0,
  total_egresos numeric(18,2) NOT NULL DEFAULT 0,
  estado public.treasury_extracto_estado NOT NULL DEFAULT 'procesando',
  parse_log jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_ext_banco ON public.treasury_extractos(banco_id);
CREATE INDEX idx_treasury_ext_estado ON public.treasury_extractos(estado);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_extractos TO authenticated;
GRANT ALL ON public.treasury_extractos TO service_role;
ALTER TABLE public.treasury_extractos ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_extractos_all ON public.treasury_extractos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER tg_treasury_ext_upd BEFORE UPDATE ON public.treasury_extractos
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============== treasury_movimientos ==============
CREATE TABLE public.treasury_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extracto_id uuid NOT NULL REFERENCES public.treasury_extractos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  valor numeric(18,2) NOT NULL,
  tipo public.treasury_mov_tipo NOT NULL,
  descripcion_raw text,
  referencia text,
  contraparte text,
  canal text,
  estado_match public.treasury_mov_estado NOT NULL DEFAULT 'no_identificado',
  confianza numeric(5,2) NOT NULL DEFAULT 0,
  match_tipo public.treasury_match_tipo,
  match_id uuid,
  conciliado_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conciliado_at timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_mov_ext ON public.treasury_movimientos(extracto_id);
CREATE INDEX idx_treasury_mov_estado ON public.treasury_movimientos(estado_match);
CREATE INDEX idx_treasury_mov_fecha ON public.treasury_movimientos(fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_movimientos TO authenticated;
GRANT ALL ON public.treasury_movimientos TO service_role;
ALTER TABLE public.treasury_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_mov_all ON public.treasury_movimientos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER tg_treasury_mov_upd BEFORE UPDATE ON public.treasury_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============== treasury_match_candidatos ==============
CREATE TABLE public.treasury_match_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id uuid NOT NULL REFERENCES public.treasury_movimientos(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL,
  match_tipo public.treasury_match_tipo NOT NULL,
  match_id uuid NOT NULL,
  motivo jsonb NOT NULL DEFAULT '{}'::jsonb,
  posicion smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_cand_mov ON public.treasury_match_candidatos(movimiento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_match_candidatos TO authenticated;
GRANT ALL ON public.treasury_match_candidatos TO service_role;
ALTER TABLE public.treasury_match_candidatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_cand_all ON public.treasury_match_candidatos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));

-- ============== treasury_match_rules ==============
CREATE TABLE public.treasury_match_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patron text NOT NULL,
  canal text,
  contraparte_hint text,
  match_tipo public.treasury_match_tipo NOT NULL,
  match_id_default uuid,
  cliente_id_default uuid,
  activa boolean NOT NULL DEFAULT true,
  veces_aplicada integer NOT NULL DEFAULT 0,
  ultimo_uso timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_rules_activa ON public.treasury_match_rules(activa) WHERE activa = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_match_rules TO authenticated;
GRANT ALL ON public.treasury_match_rules TO service_role;
ALTER TABLE public.treasury_match_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_rules_all ON public.treasury_match_rules FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));

-- ============== treasury_ajustes ==============
CREATE TABLE public.treasury_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id uuid NOT NULL REFERENCES public.treasury_movimientos(id) ON DELETE CASCADE,
  accion text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_aj_mov ON public.treasury_ajustes(movimiento_id);
GRANT SELECT, INSERT ON public.treasury_ajustes TO authenticated;
GRANT ALL ON public.treasury_ajustes TO service_role;
ALTER TABLE public.treasury_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_aj_read ON public.treasury_ajustes FOR SELECT TO authenticated
  USING (public.can_manage_finanzas(auth.uid()));
CREATE POLICY treasury_aj_ins ON public.treasury_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finanzas(auth.uid()) AND user_id = auth.uid());

-- ============== treasury_auditoria ==============
CREATE TABLE public.treasury_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad text NOT NULL,
  entidad_id uuid,
  accion text NOT NULL,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasury_aud_entidad ON public.treasury_auditoria(entidad, entidad_id);
CREATE INDEX idx_treasury_aud_created ON public.treasury_auditoria(created_at DESC);
GRANT SELECT, INSERT ON public.treasury_auditoria TO authenticated;
GRANT ALL ON public.treasury_auditoria TO service_role;
ALTER TABLE public.treasury_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_aud_read ON public.treasury_auditoria FOR SELECT TO authenticated
  USING (public.can_manage_finanzas(auth.uid()));
CREATE POLICY treasury_aud_ins ON public.treasury_auditoria FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finanzas(auth.uid()));

-- ============== treasury_config ==============
CREATE TABLE public.treasury_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_config TO authenticated;
GRANT ALL ON public.treasury_config TO service_role;
ALTER TABLE public.treasury_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_config_all ON public.treasury_config FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));

-- Seed default config
INSERT INTO public.treasury_config(key, value) VALUES
  ('umbral_auto_conciliar', '92'::jsonb),
  ('umbral_sugerir', '70'::jsonb),
  ('tolerancia_pct', '1.5'::jsonb)
ON CONFLICT (key) DO NOTHING;
