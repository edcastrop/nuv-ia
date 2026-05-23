
-- ============================================================
-- CENTRO DE CARTERA NUVEX
-- ============================================================

-- 1. Nuevos estados de caso
ALTER TYPE caso_estado ADD VALUE IF NOT EXISTS 'documentos_banco_firmados' AFTER 'aprobado';
ALTER TYPE caso_estado ADD VALUE IF NOT EXISTS 'condiciones_aplicadas' AFTER 'documentos_banco_firmados';
ALTER TYPE caso_estado ADD VALUE IF NOT EXISTS 'cuenta_cobro_generada' AFTER 'resultado_final_generado';
ALTER TYPE caso_estado ADD VALUE IF NOT EXISTS 'prejuridico';

-- 2. Enum cartera_estado
DO $$ BEGIN
  CREATE TYPE cartera_estado AS ENUM (
    'pendiente_cobro',
    'cuenta_cobro_generada',
    'cuenta_cobro_enviada',
    'pago_parcial',
    'pago_total',
    'vencido',
    'acuerdo_pago',
    'en_seguimiento',
    'prejuridico',
    'cerrado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabla cartera
CREATE TABLE IF NOT EXISTS public.cartera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL UNIQUE,
  responsable_id uuid,
  estado_cartera cartera_estado NOT NULL DEFAULT 'pendiente_cobro',
  forma_pago text NOT NULL DEFAULT 'contado' CHECK (forma_pago IN ('contado','financiado')),
  fecha_aplicacion_banco date NOT NULL,
  fecha_resultado_final date,
  fecha_cuenta_cobro date,
  fecha_vencimiento date NOT NULL,
  honorarios_totales numeric(14,2) NOT NULL DEFAULT 0,
  pagado numeric(14,2) NOT NULL DEFAULT 0,
  observaciones text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cartera_expediente ON public.cartera(expediente_id);
CREATE INDEX IF NOT EXISTS idx_cartera_estado ON public.cartera(estado_cartera);
CREATE INDEX IF NOT EXISTS idx_cartera_responsable ON public.cartera(responsable_id);

-- 4. cartera_cuotas
CREATE TABLE IF NOT EXISTS public.cartera_cuotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id uuid NOT NULL REFERENCES public.cartera(id) ON DELETE CASCADE,
  numero int NOT NULL,
  valor numeric(14,2) NOT NULL,
  fecha_vencimiento date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','vencida')),
  pagado numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cuotas_cartera ON public.cartera_cuotas(cartera_id);

-- 5. cartera_pagos
CREATE TABLE IF NOT EXISTS public.cartera_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id uuid NOT NULL REFERENCES public.cartera(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  metodo text,
  banco_receptor text,
  comprobante_num text,
  comprobante_url text,
  observaciones text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagos_cartera ON public.cartera_pagos(cartera_id);

-- 6. cartera_acuerdos
CREATE TABLE IF NOT EXISTS public.cartera_acuerdos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id uuid NOT NULL REFERENCES public.cartera(id) ON DELETE CASCADE,
  valor_total numeric(14,2) NOT NULL,
  numero_cuotas int NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','cumplido','incumplido','cancelado')),
  observaciones text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acuerdos_cartera ON public.cartera_acuerdos(cartera_id);

-- 7. cartera_comunicaciones
CREATE TABLE IF NOT EXISTS public.cartera_comunicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id uuid NOT NULL REFERENCES public.cartera(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('email','whatsapp')),
  estado text NOT NULL DEFAULT 'enviado',
  asunto text,
  destinatario text,
  body text,
  proveedor_msg_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_com_cartera ON public.cartera_comunicaciones(cartera_id);
CREATE INDEX IF NOT EXISTS idx_com_tipo ON public.cartera_comunicaciones(cartera_id, tipo);

-- 8. cartera_auditoria
CREATE TABLE IF NOT EXISTS public.cartera_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id uuid NOT NULL REFERENCES public.cartera(id) ON DELETE CASCADE,
  user_id uuid,
  accion text NOT NULL,
  observacion text,
  canal text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_cartera ON public.cartera_auditoria(cartera_id);

-- 9. updated_at trigger
DROP TRIGGER IF EXISTS trg_cartera_updated_at ON public.cartera;
CREATE TRIGGER trg_cartera_updated_at BEFORE UPDATE ON public.cartera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Recalc trigger en cartera_pagos
CREATE OR REPLACE FUNCTION public.recalc_cartera_saldo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
  total_pagado numeric(14,2);
  total_honorarios numeric(14,2);
  exp_id uuid;
BEGIN
  cid := COALESCE(NEW.cartera_id, OLD.cartera_id);
  SELECT COALESCE(SUM(valor),0) INTO total_pagado FROM public.cartera_pagos WHERE cartera_id = cid;
  SELECT honorarios_totales, expediente_id INTO total_honorarios, exp_id FROM public.cartera WHERE id = cid;
  UPDATE public.cartera SET pagado = total_pagado WHERE id = cid;

  IF total_pagado >= total_honorarios AND total_honorarios > 0 THEN
    UPDATE public.cartera SET estado_cartera = 'pago_total' WHERE id = cid;
    UPDATE public.expedientes SET estado_caso = 'honorarios_pagados' WHERE id = exp_id;
  ELSIF total_pagado > 0 AND total_pagado < total_honorarios THEN
    UPDATE public.cartera SET estado_cartera = 'pago_parcial'
      WHERE id = cid AND estado_cartera NOT IN ('prejuridico','acuerdo_pago','cerrado');
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recalc_pago_ins ON public.cartera_pagos;
CREATE TRIGGER trg_recalc_pago_ins AFTER INSERT OR UPDATE OR DELETE ON public.cartera_pagos
  FOR EACH ROW EXECUTE FUNCTION public.recalc_cartera_saldo();

-- 11. Auditoría auto en pagos y comunicaciones
CREATE OR REPLACE FUNCTION public.audit_cartera_pago()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cartera_auditoria (cartera_id, user_id, accion, observacion, canal)
  VALUES (NEW.cartera_id, NEW.user_id,
    'pago_registrado',
    'Pago $'||NEW.valor::text||COALESCE(' - '||NEW.metodo,''),
    NEW.metodo);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_pago ON public.cartera_pagos;
CREATE TRIGGER trg_audit_pago AFTER INSERT ON public.cartera_pagos
  FOR EACH ROW EXECUTE FUNCTION public.audit_cartera_pago();

CREATE OR REPLACE FUNCTION public.audit_cartera_comunicacion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cartera_auditoria (cartera_id, user_id, accion, observacion, canal)
  VALUES (NEW.cartera_id, NEW.user_id,
    'comunicacion_'||NEW.tipo,
    COALESCE(NEW.asunto, NEW.tipo),
    NEW.canal);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_com ON public.cartera_comunicaciones;
CREATE TRIGGER trg_audit_com AFTER INSERT ON public.cartera_comunicaciones
  FOR EACH ROW EXECUTE FUNCTION public.audit_cartera_comunicacion();

-- 12. RLS
ALTER TABLE public.cartera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_acuerdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_comunicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_auditoria ENABLE ROW LEVEL SECURITY;

-- Función helper: ¿puede gestionar cartera?
CREATE OR REPLACE FUNCTION public.can_manage_cartera(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(_uid, 'super_admin') OR has_role(_uid, 'admin')
      OR has_role(_uid, 'gerencia')   OR has_role(_uid, 'cartera');
$$;

CREATE OR REPLACE FUNCTION public.can_view_cartera_row(_uid uuid, _exp_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_cartera(_uid)
      OR has_role(_uid, 'juridica')
      OR EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = _exp_id AND e.asesor_id = _uid);
$$;

-- cartera policies
CREATE POLICY "Cartera select" ON public.cartera FOR SELECT TO authenticated
  USING (public.can_view_cartera_row(auth.uid(), expediente_id));
CREATE POLICY "Cartera insert" ON public.cartera FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_cartera(auth.uid()));
CREATE POLICY "Cartera update" ON public.cartera FOR UPDATE TO authenticated
  USING (public.can_manage_cartera(auth.uid()));
CREATE POLICY "Cartera delete" ON public.cartera FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- children policies (mismo criterio via cartera)
CREATE POLICY "Cuotas select" ON public.cartera_cuotas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cartera c WHERE c.id = cartera_id AND public.can_view_cartera_row(auth.uid(), c.expediente_id)));
CREATE POLICY "Cuotas write" ON public.cartera_cuotas FOR ALL TO authenticated
  USING (public.can_manage_cartera(auth.uid()))
  WITH CHECK (public.can_manage_cartera(auth.uid()));

CREATE POLICY "Pagos select" ON public.cartera_pagos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cartera c WHERE c.id = cartera_id AND public.can_view_cartera_row(auth.uid(), c.expediente_id)));
CREATE POLICY "Pagos insert" ON public.cartera_pagos FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_cartera(auth.uid()));
CREATE POLICY "Pagos update" ON public.cartera_pagos FOR UPDATE TO authenticated
  USING (public.can_manage_cartera(auth.uid()));
CREATE POLICY "Pagos delete" ON public.cartera_pagos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Acuerdos select" ON public.cartera_acuerdos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cartera c WHERE c.id = cartera_id AND public.can_view_cartera_row(auth.uid(), c.expediente_id)));
CREATE POLICY "Acuerdos write" ON public.cartera_acuerdos FOR ALL TO authenticated
  USING (public.can_manage_cartera(auth.uid()))
  WITH CHECK (public.can_manage_cartera(auth.uid()));

CREATE POLICY "Com select" ON public.cartera_comunicaciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cartera c WHERE c.id = cartera_id AND public.can_view_cartera_row(auth.uid(), c.expediente_id)));
CREATE POLICY "Com insert" ON public.cartera_comunicaciones FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_cartera(auth.uid()));

CREATE POLICY "Audit select" ON public.cartera_auditoria FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cartera c WHERE c.id = cartera_id AND public.can_view_cartera_row(auth.uid(), c.expediente_id)));
CREATE POLICY "Audit insert" ON public.cartera_auditoria FOR INSERT TO authenticated
  WITH CHECK (true);

-- 13. Storage bucket comprobantes (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('cartera-comprobantes','cartera-comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Comprobantes select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cartera-comprobantes' AND public.can_manage_cartera(auth.uid()));
CREATE POLICY "Comprobantes insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cartera-comprobantes' AND public.can_manage_cartera(auth.uid()));
CREATE POLICY "Comprobantes delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cartera-comprobantes' AND public.can_manage_cartera(auth.uid()));
