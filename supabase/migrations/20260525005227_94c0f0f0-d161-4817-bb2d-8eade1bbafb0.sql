
CREATE OR REPLACE FUNCTION public.can_manage_finanzas(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(_uid, 'super_admin') OR has_role(_uid, 'admin')
      OR has_role(_uid, 'gerencia')   OR has_role(_uid, 'contabilidad');
$$;

CREATE TABLE public.nomina_empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nombre text NOT NULL,
  documento text,
  cargo text,
  area text,
  tipo_contrato text NOT NULL DEFAULT 'indefinido',
  valor_mensual numeric(14,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nomina_empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empleados manage finanzas" ON public.nomina_empleados FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid())) WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE POLICY "Empleados ven su ficha" ON public.nomina_empleados FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER trg_nomina_empleados_updated BEFORE UPDATE ON public.nomina_empleados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nomina_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.nomina_empleados(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  fecha_pago date,
  estado text NOT NULL DEFAULT 'pendiente',
  comprobante_url text,
  comprobante_num text,
  observaciones text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empleado_id, periodo)
);
ALTER TABLE public.nomina_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nomina pagos manage" ON public.nomina_pagos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid())) WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER trg_nomina_pagos_updated BEFORE UPDATE ON public.nomina_pagos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tesoreria_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  categoria text NOT NULL,
  valor numeric(14,2) NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  descripcion text,
  comprobante_url text,
  expediente_id uuid,
  cuenta_cobro_id uuid,
  nomina_pago_id uuid,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tesoreria_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tesoreria manage" ON public.tesoreria_movimientos FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid())) WITH CHECK (public.can_manage_finanzas(auth.uid()));
CREATE TRIGGER trg_tesoreria_updated BEFORE UPDATE ON public.tesoreria_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finanzas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  rol text,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id uuid,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  motivo text,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finanzas_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit insert auth" ON public.finanzas_auditoria FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Audit select manage" ON public.finanzas_auditoria FOR SELECT TO authenticated
  USING (public.can_manage_finanzas(auth.uid()));

CREATE TABLE public.finanzas_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidad text NOT NULL DEFAULT 'media',
  expediente_id uuid,
  cartera_id uuid,
  cuenta_cobro_id uuid,
  nomina_pago_id uuid,
  titulo text NOT NULL,
  mensaje_ia text,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finanzas_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alertas finanzas manage" ON public.finanzas_alertas FOR ALL TO authenticated
  USING (public.can_manage_finanzas(auth.uid())) WITH CHECK (public.can_manage_finanzas(auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes-finanzas','comprobantes-finanzas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Comprobantes finanzas select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes-finanzas' AND public.can_manage_finanzas(auth.uid()));
CREATE POLICY "Comprobantes finanzas insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes-finanzas' AND public.can_manage_finanzas(auth.uid()));
CREATE POLICY "Comprobantes finanzas update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comprobantes-finanzas' AND public.can_manage_finanzas(auth.uid()));
CREATE POLICY "Comprobantes finanzas delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprobantes-finanzas' AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')));
