
CREATE TABLE public.proyecciones_financieras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  expediente_id UUID NULL,
  cliente_nombre TEXT NOT NULL DEFAULT '',
  banco TEXT NOT NULL DEFAULT '',
  tipo_producto TEXT NOT NULL DEFAULT 'hipotecario',
  moneda TEXT NOT NULL DEFAULT 'pesos',
  fecha_desembolso DATE NULL,
  valor_desembolsado NUMERIC NOT NULL DEFAULT 0,
  saldo_capital NUMERIC NOT NULL DEFAULT 0,
  cuota_actual NUMERIC NOT NULL DEFAULT 0,
  tea_pct NUMERIC NOT NULL DEFAULT 0,
  cuotas_totales INTEGER NOT NULL DEFAULT 0,
  cuotas_pagadas INTEGER NOT NULL DEFAULT 0,
  cuotas_pendientes INTEGER NOT NULL DEFAULT 0,
  fecha_terminacion_estimada DATE NULL,
  seguro_vida NUMERIC NOT NULL DEFAULT 0,
  seguro_incendio NUMERIC NOT NULL DEFAULT 0,
  seguro_terremoto NUMERIC NOT NULL DEFAULT 0,
  otros_seguros NUMERIC NOT NULL DEFAULT 0,
  uvr_valor NUMERIC NOT NULL DEFAULT 0,
  saldo_uvr NUMERIC NOT NULL DEFAULT 0,
  variacion_uvr_pct NUMERIC NOT NULL DEFAULT 6,
  notas TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyecciones_financieras TO authenticated;
GRANT ALL ON public.proyecciones_financieras TO service_role;

ALTER TABLE public.proyecciones_financieras ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_proyeccion_financiera(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role)
      OR public.has_role(_uid,'licenciado'::app_role)
      OR public.has_role(_uid,'director_financiero_qa'::app_role);
$$;

CREATE POLICY "PF select" ON public.proyecciones_financieras
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.can_use_proyeccion_financiera(auth.uid()));

CREATE POLICY "PF insert" ON public.proyecciones_financieras
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_use_proyeccion_financiera(auth.uid()));

CREATE POLICY "PF update" ON public.proyecciones_financieras
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'gerencia'::app_role));

CREATE POLICY "PF delete" ON public.proyecciones_financieras
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE TRIGGER trg_pf_updated_at
BEFORE UPDATE ON public.proyecciones_financieras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.proyeccion_escenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyeccion_id UUID NOT NULL REFERENCES public.proyecciones_financieras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT 'Escenario',
  tipo TEXT NOT NULL DEFAULT 'personalizado',
  aporte_mensual_extra NUMERIC NOT NULL DEFAULT 0,
  abono_extraordinario NUMERIC NOT NULL DEFAULT 0,
  nueva_tasa NUMERIC NULL,
  nuevo_plazo INTEGER NULL,
  resultado_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyeccion_escenarios TO authenticated;
GRANT ALL ON public.proyeccion_escenarios TO service_role;

ALTER TABLE public.proyeccion_escenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PFE select" ON public.proyeccion_escenarios
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proyecciones_financieras p
    WHERE p.id = proyeccion_id
      AND (p.created_by = auth.uid() OR public.can_use_proyeccion_financiera(auth.uid()))));

CREATE POLICY "PFE insert" ON public.proyeccion_escenarios
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.proyecciones_financieras p
    WHERE p.id = proyeccion_id
      AND (p.created_by = auth.uid() OR public.can_use_proyeccion_financiera(auth.uid()))));

CREATE POLICY "PFE update" ON public.proyeccion_escenarios
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proyecciones_financieras p
    WHERE p.id = proyeccion_id
      AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'gerencia'::app_role))));

CREATE POLICY "PFE delete" ON public.proyeccion_escenarios
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proyecciones_financieras p
    WHERE p.id = proyeccion_id
      AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role))));

CREATE TRIGGER trg_pfe_updated_at
BEFORE UPDATE ON public.proyeccion_escenarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pf_created_by ON public.proyecciones_financieras(created_by);
CREATE INDEX idx_pfe_proyeccion ON public.proyeccion_escenarios(proyeccion_id);
