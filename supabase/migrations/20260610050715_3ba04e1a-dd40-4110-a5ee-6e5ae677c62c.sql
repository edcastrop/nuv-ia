
CREATE TABLE public.analisis_capacidad_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  tipo_persona TEXT NOT NULL CHECK (tipo_persona IN ('empleado_mensual','empleado_quincenal','independiente')),
  es_vis BOOLEAN NOT NULL DEFAULT false,
  cuota_propuesta NUMERIC NOT NULL,
  ingreso_titular NUMERIC NOT NULL DEFAULT 0,
  ingreso_codeudor NUMERIC NOT NULL DEFAULT 0,
  ingreso_total NUMERIC GENERATED ALWAYS AS (ingreso_titular + ingreso_codeudor) STORED,
  porcentaje_endeudamiento NUMERIC,
  limite_aplicable NUMERIC NOT NULL,
  semaforo TEXT NOT NULL CHECK (semaforo IN ('verde','amarillo','rojo','sin_datos')),
  modelo_ia TEXT,
  confianza NUMERIC,
  observaciones TEXT[],
  detalle_titular JSONB DEFAULT '{}'::jsonb,
  detalle_codeudor JSONB DEFAULT '{}'::jsonb,
  payload_ia JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analisis_capacidad_expediente ON public.analisis_capacidad_pago(expediente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analisis_capacidad_pago TO authenticated;
GRANT ALL ON public.analisis_capacidad_pago TO service_role;

ALTER TABLE public.analisis_capacidad_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read analisis capacidad"
  ON public.analisis_capacidad_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert analisis capacidad"
  ON public.analisis_capacidad_pago FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update analisis capacidad"
  ON public.analisis_capacidad_pago FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete analisis capacidad"
  ON public.analisis_capacidad_pago FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_analisis_capacidad_updated
  BEFORE UPDATE ON public.analisis_capacidad_pago
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for bucket capacidad-pago-docs
CREATE POLICY "auth read capacidad docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'capacidad-pago-docs');
CREATE POLICY "auth insert capacidad docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'capacidad-pago-docs');
CREATE POLICY "auth update capacidad docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'capacidad-pago-docs');
CREATE POLICY "auth delete capacidad docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'capacidad-pago-docs');
