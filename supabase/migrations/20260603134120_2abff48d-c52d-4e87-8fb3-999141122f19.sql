
-- =====================================================
-- WALLET DE COMISIONES
-- =====================================================

-- Tipo de movimiento
DO $$ BEGIN
  CREATE TYPE public.wallet_mov_tipo AS ENUM (
    'comision_generada',
    'comision_liberada',
    'comision_pagada',
    'cc_creada',
    'cc_enviada',
    'cc_aprobada',
    'cc_pagada',
    'cc_rechazada',
    'ajuste_credito',
    'ajuste_debito',
    'retencion',
    'liberacion_retencion'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabla de movimientos (bitácora derivada / auditable)
CREATE TABLE IF NOT EXISTS public.wallet_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo public.wallet_mov_tipo NOT NULL,
  monto numeric(14,2) NOT NULL DEFAULT 0,
  descripcion text,
  comision_id uuid,
  cuenta_cobro_id uuid,
  ajuste_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_mov_user_created ON public.wallet_movimientos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_mov_comision ON public.wallet_movimientos(comision_id);
CREATE INDEX IF NOT EXISTS idx_wallet_mov_cc ON public.wallet_movimientos(cuenta_cobro_id);

GRANT SELECT, INSERT ON public.wallet_movimientos TO authenticated;
GRANT ALL ON public.wallet_movimientos TO service_role;

ALTER TABLE public.wallet_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_mov_self_select" ON public.wallet_movimientos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_finanzas(auth.uid()));

CREATE POLICY "wallet_mov_finanzas_insert" ON public.wallet_movimientos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finanzas(auth.uid()));


-- Ajustes manuales
CREATE TABLE IF NOT EXISTS public.wallet_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo public.wallet_mov_tipo NOT NULL CHECK (tipo IN ('ajuste_credito','ajuste_debito','retencion','liberacion_retencion')),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  motivo text NOT NULL,
  anulado boolean NOT NULL DEFAULT false,
  anulado_at timestamptz,
  anulado_por uuid,
  anulado_motivo text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ajustes_user ON public.wallet_ajustes(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.wallet_ajustes TO authenticated;
GRANT ALL ON public.wallet_ajustes TO service_role;

ALTER TABLE public.wallet_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_aj_self_select" ON public.wallet_ajustes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_finanzas(auth.uid()));

CREATE POLICY "wallet_aj_finanzas_insert" ON public.wallet_ajustes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finanzas(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "wallet_aj_finanzas_update" ON public.wallet_ajustes
  FOR UPDATE TO authenticated
  USING (public.can_manage_finanzas(auth.uid()))
  WITH CHECK (public.can_manage_finanzas(auth.uid()));


-- =====================================================
-- TRIGGERS: comisiones -> wallet_movimientos
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_wallet_from_comision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_delta_liberada numeric(14,2);
  v_delta_pagada numeric(14,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id, metadata)
    VALUES (NEW.user_id, 'comision_generada', COALESCE(NEW.comision_potencial, NEW.valor, 0),
      'Comisión generada (potencial)', NEW.id,
      jsonb_build_object('expediente_id', NEW.expediente_id, 'rol', NEW.rol));
    IF COALESCE(NEW.comision_liberada,0) > 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (NEW.user_id, 'comision_liberada', NEW.comision_liberada,
        'Comisión liberada por recaudo', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_delta_liberada := COALESCE(NEW.comision_liberada,0) - COALESCE(OLD.comision_liberada,0);
    v_delta_pagada := COALESCE(NEW.comision_pagada,0) - COALESCE(OLD.comision_pagada,0);

    IF v_delta_liberada <> 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (NEW.user_id,
        CASE WHEN v_delta_liberada > 0 THEN 'comision_liberada' ELSE 'ajuste_debito' END,
        ABS(v_delta_liberada),
        CASE WHEN v_delta_liberada > 0 THEN 'Liberación por recaudo' ELSE 'Reversión de liberación' END,
        NEW.id);
    END IF;

    IF v_delta_pagada <> 0 THEN
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, comision_id)
      VALUES (NEW.user_id,
        CASE WHEN v_delta_pagada > 0 THEN 'comision_pagada' ELSE 'ajuste_credito' END,
        ABS(v_delta_pagada),
        CASE WHEN v_delta_pagada > 0 THEN 'Pago de comisión' ELSE 'Reversión de pago' END,
        NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $fn$;

DROP TRIGGER IF EXISTS trg_wallet_comisiones ON public.comisiones;
CREATE TRIGGER trg_wallet_comisiones
AFTER INSERT OR UPDATE ON public.comisiones
FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_from_comision();


-- Triggers: cuentas_cobro -> wallet_movimientos
CREATE OR REPLACE FUNCTION public.trg_wallet_from_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tipo public.wallet_mov_tipo;
  v_desc text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, cuenta_cobro_id, metadata)
    VALUES (NEW.user_id, 'cc_creada', COALESCE(NEW.total,0),
      'Cuenta de cobro creada ' || COALESCE(NEW.numero, ''), NEW.id,
      jsonb_build_object('estado', NEW.estado));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_tipo := CASE NEW.estado
      WHEN 'enviada' THEN 'cc_enviada'::public.wallet_mov_tipo
      WHEN 'aprobada' THEN 'cc_aprobada'::public.wallet_mov_tipo
      WHEN 'pagada' THEN 'cc_pagada'::public.wallet_mov_tipo
      WHEN 'rechazada' THEN 'cc_rechazada'::public.wallet_mov_tipo
      ELSE NULL
    END;
    IF v_tipo IS NOT NULL THEN
      v_desc := 'CC ' || COALESCE(NEW.numero,'') || ' → ' || NEW.estado;
      INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, cuenta_cobro_id, metadata)
      VALUES (NEW.user_id, v_tipo, COALESCE(NEW.total,0), v_desc, NEW.id,
        jsonb_build_object('estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado));
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $fn$;

DROP TRIGGER IF EXISTS trg_wallet_cc ON public.cuentas_cobro;
CREATE TRIGGER trg_wallet_cc
AFTER INSERT OR UPDATE ON public.cuentas_cobro
FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_from_cc();


-- Trigger: wallet_ajustes -> wallet_movimientos
CREATE OR REPLACE FUNCTION public.trg_wallet_from_ajuste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, ajuste_id, actor_id, metadata)
    VALUES (NEW.user_id, NEW.tipo, NEW.monto, NEW.motivo, NEW.id, NEW.created_by,
      jsonb_build_object('ajuste', true));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.anulado = true AND OLD.anulado = false THEN
    -- Movimiento de reversa
    INSERT INTO public.wallet_movimientos(user_id, tipo, monto, descripcion, ajuste_id, actor_id, metadata)
    VALUES (NEW.user_id,
      CASE NEW.tipo
        WHEN 'ajuste_credito' THEN 'ajuste_debito'::public.wallet_mov_tipo
        WHEN 'ajuste_debito' THEN 'ajuste_credito'::public.wallet_mov_tipo
        WHEN 'retencion' THEN 'liberacion_retencion'::public.wallet_mov_tipo
        WHEN 'liberacion_retencion' THEN 'retencion'::public.wallet_mov_tipo
      END,
      NEW.monto,
      'Anulación de ajuste: ' || COALESCE(NEW.anulado_motivo, NEW.motivo),
      NEW.id, NEW.anulado_por,
      jsonb_build_object('anulacion', true));
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_wallet_ajustes ON public.wallet_ajustes;
CREATE TRIGGER trg_wallet_ajustes
AFTER INSERT OR UPDATE ON public.wallet_ajustes
FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_from_ajuste();


-- =====================================================
-- Función: saldos en vivo
-- =====================================================
CREATE OR REPLACE FUNCTION public.wallet_saldos(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_disponible numeric(14,2) := 0;
  v_en_tramite numeric(14,2) := 0;
  v_pendiente_recaudo numeric(14,2) := 0;
  v_pagado numeric(14,2) := 0;
  v_ajustes_credito numeric(14,2) := 0;
  v_ajustes_debito numeric(14,2) := 0;
  v_retenido numeric(14,2) := 0;
BEGIN
  -- Validar acceso
  IF _user_id <> auth.uid() AND NOT public.can_manage_finanzas(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Disponible (liberado - pagado, sin CC activa)
  SELECT COALESCE(SUM(GREATEST(0, COALESCE(comision_liberada,0) - COALESCE(comision_pagada,0))),0)
    INTO v_disponible
    FROM public.comisiones
    WHERE user_id = _user_id AND cuenta_cobro_id IS NULL;

  -- En trámite (CC borrador/enviada/aprobada)
  SELECT COALESCE(SUM(total),0) INTO v_en_tramite
    FROM public.cuentas_cobro
    WHERE user_id = _user_id AND estado IN ('borrador','enviada','aprobada');

  -- Pendiente de recaudo (potencial - liberado)
  SELECT COALESCE(SUM(GREATEST(0, COALESCE(comision_potencial,0) - COALESCE(comision_liberada,0))),0)
    INTO v_pendiente_recaudo
    FROM public.comisiones
    WHERE user_id = _user_id;

  -- Pagado histórico
  SELECT COALESCE(SUM(comision_pagada),0) INTO v_pagado
    FROM public.comisiones WHERE user_id = _user_id;

  -- Ajustes vigentes
  SELECT COALESCE(SUM(monto) FILTER (WHERE tipo='ajuste_credito'),0),
         COALESCE(SUM(monto) FILTER (WHERE tipo='ajuste_debito'),0),
         COALESCE(SUM(monto) FILTER (WHERE tipo='retencion'),0)
         - COALESCE(SUM(monto) FILTER (WHERE tipo='liberacion_retencion'),0)
    INTO v_ajustes_credito, v_ajustes_debito, v_retenido
    FROM public.wallet_ajustes
    WHERE user_id = _user_id AND anulado = false;

  RETURN jsonb_build_object(
    'disponible', v_disponible + v_ajustes_credito - v_ajustes_debito - GREATEST(0, v_retenido),
    'en_tramite', v_en_tramite,
    'pendiente_recaudo', v_pendiente_recaudo,
    'pagado_historico', v_pagado,
    'ajustes_credito', v_ajustes_credito,
    'ajustes_debito', v_ajustes_debito,
    'retenido', GREATEST(0, v_retenido)
  );
END $fn$;

GRANT EXECUTE ON FUNCTION public.wallet_saldos(uuid) TO authenticated;
