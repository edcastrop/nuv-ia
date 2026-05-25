-- ============================================================
-- ENTREGA 4: COMISIONES + CUENTAS DE COBRO
-- ============================================================

-- Reglas de comisión por licenciado/asesor/banco
CREATE TABLE IF NOT EXISTS public.comisiones_reglas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'licenciado',
  banco text,
  porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comisiones_reglas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reglas select autenticados" ON public.comisiones_reglas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reglas manage admin/gerencia" ON public.comisiones_reglas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin'));

-- Comisiones liquidadas
CREATE TABLE IF NOT EXISTS public.comisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'licenciado',
  base numeric(14,2) NOT NULL DEFAULT 0,
  porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'generada',
  cuenta_cobro_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expediente_id, user_id, rol)
);
ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comisiones select propio o manager" ON public.comisiones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'cartera'));
CREATE POLICY "Comisiones manage admin" ON public.comisiones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin'));

-- Cuentas de cobro
CREATE TABLE IF NOT EXISTS public.cuentas_cobro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT ('CC-' || to_char(now(),'YYYYMMDD-HH24MISS')),
  user_id uuid NOT NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'borrador', -- borrador|enviada|aprobada|rechazada|pagada
  fecha_envio timestamptz,
  fecha_aprobacion timestamptz,
  fecha_pago timestamptz,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cuentas_cobro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CC select propio o manager" ON public.cuentas_cobro
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'cartera'));
CREATE POLICY "CC insert propio" ON public.cuentas_cobro
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "CC update propio borrador" ON public.cuentas_cobro
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'cartera'));
CREATE POLICY "CC delete admin" ON public.cuentas_cobro
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- Historial de cuentas
CREATE TABLE IF NOT EXISTS public.cuentas_cobro_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_cobro_id uuid NOT NULL REFERENCES public.cuentas_cobro(id) ON DELETE CASCADE,
  user_id uuid,
  accion text NOT NULL,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cuentas_cobro_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CC hist select" ON public.cuentas_cobro_historial
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cuentas_cobro c WHERE c.id = cuenta_cobro_id
    AND (c.user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerencia') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'cartera'))));
CREATE POLICY "CC hist insert" ON public.cuentas_cobro_historial
  FOR INSERT TO authenticated WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER trg_comisiones_updated BEFORE UPDATE ON public.comisiones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cuentas_cobro_updated BEFORE UPDATE ON public.cuentas_cobro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comisiones_reglas_updated BEFORE UPDATE ON public.comisiones_reglas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-liquidación al pasar a honorarios_pagados
CREATE OR REPLACE FUNCTION public.auto_liquidar_comision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regla record;
  v_base numeric(14,2);
  v_porc numeric(5,2);
  v_valor numeric(14,2);
BEGIN
  IF NEW.estado_caso = 'honorarios_pagados'
     AND (OLD.estado_caso IS DISTINCT FROM NEW.estado_caso) THEN

    v_base := COALESCE(NEW.honorarios_final, 0);
    IF v_base <= 0 THEN RETURN NEW; END IF;

    -- Buscar regla específica por banco, sino general
    SELECT * INTO v_regla FROM public.comisiones_reglas
      WHERE user_id = NEW.asesor_id AND activo = true
        AND (banco = NEW.banco OR banco IS NULL)
      ORDER BY (banco = NEW.banco) DESC NULLS LAST
      LIMIT 1;

    v_porc := COALESCE(v_regla.porcentaje, 0);
    v_valor := ROUND(v_base * v_porc / 100, 2);

    INSERT INTO public.comisiones (expediente_id, user_id, rol, base, porcentaje, valor, estado)
    VALUES (NEW.id, NEW.asesor_id, COALESCE(v_regla.rol,'licenciado'), v_base, v_porc, v_valor, 'generada')
    ON CONFLICT (expediente_id, user_id, rol) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_liquidar_comision ON public.expedientes;
CREATE TRIGGER trg_auto_liquidar_comision
  AFTER UPDATE OF estado_caso ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.auto_liquidar_comision();

-- Recalcular total al modificar items de la cuenta
CREATE OR REPLACE FUNCTION public.recalc_cuenta_cobro_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc_id uuid;
BEGIN
  v_cc_id := COALESCE(NEW.cuenta_cobro_id, OLD.cuenta_cobro_id);
  IF v_cc_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.cuentas_cobro
    SET total = COALESCE((SELECT SUM(valor) FROM public.comisiones WHERE cuenta_cobro_id = v_cc_id), 0)
    WHERE id = v_cc_id;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recalc_cc_total ON public.comisiones;
CREATE TRIGGER trg_recalc_cc_total
  AFTER INSERT OR UPDATE OF cuenta_cobro_id, valor OR DELETE ON public.comisiones
  FOR EACH ROW EXECUTE FUNCTION public.recalc_cuenta_cobro_total();