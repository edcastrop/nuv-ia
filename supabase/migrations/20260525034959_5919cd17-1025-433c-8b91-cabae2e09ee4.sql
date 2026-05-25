-- ============= Fase 2: Métodos de pago, cuentas receptoras y parámetros financieros =============

-- 1) Cuentas receptoras
CREATE TABLE IF NOT EXISTS public.cuentas_receptoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco text NOT NULL,
  tipo text NOT NULL DEFAULT 'ahorros', -- ahorros | corriente | billetera
  numero text,
  titular text,
  nit text,
  activa boolean NOT NULL DEFAULT true,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cuentas_receptoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cuentas receptoras select autenticados"
  ON public.cuentas_receptoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cuentas receptoras manage finanzas"
  ON public.cuentas_receptoras FOR ALL TO authenticated
  USING (can_manage_finanzas(auth.uid()))
  WITH CHECK (can_manage_finanzas(auth.uid()));

CREATE TRIGGER trg_cuentas_receptoras_updated
  BEFORE UPDATE ON public.cuentas_receptoras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fila inicial Bancolombia (editable en UI)
INSERT INTO public.cuentas_receptoras (banco, tipo, titular, activa, observaciones)
VALUES ('Bancolombia', 'ahorros', 'NUVEX', true, 'Cuenta principal — completar número y NIT en UI')
ON CONFLICT DO NOTHING;

-- 2) Parámetros financieros (clave/valor)
CREATE TABLE IF NOT EXISTS public.parametros_financieros (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descripcion text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parametros_financieros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parametros select autenticados"
  ON public.parametros_financieros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Parametros manage finanzas"
  ON public.parametros_financieros FOR ALL TO authenticated
  USING (can_manage_finanzas(auth.uid()))
  WITH CHECK (can_manage_finanzas(auth.uid()));

INSERT INTO public.parametros_financieros (clave, valor, descripcion) VALUES
  ('fee_wompi_porcentaje', '2.99'::jsonb, 'Porcentaje fee Wompi sobre valor bruto (%)'),
  ('iva_fee_wompi_porcentaje', '19'::jsonb, 'IVA aplicado sobre el fee Wompi (%)'),
  ('comision_predeterminada_licenciado', '50'::jsonb, 'Porcentaje de comisión por defecto para el licenciado (%)')
ON CONFLICT (clave) DO NOTHING;

-- 3) Ampliar cartera_pagos
ALTER TABLE public.cartera_pagos
  ADD COLUMN IF NOT EXISTS metodo_pago text,
  ADD COLUMN IF NOT EXISTS cuenta_receptora_id uuid REFERENCES public.cuentas_receptoras(id),
  ADD COLUMN IF NOT EXISTS valor_bruto numeric(14,2),
  ADD COLUMN IF NOT EXISTS fee_wompi numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_fee numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_neto numeric(14,2),
  ADD COLUMN IF NOT EXISTS numero_transaccion text;

-- 4) Trigger: calcular fee/iva/neto cuando método = wompi y no vienen desglosados
CREATE OR REPLACE FUNCTION public.calcular_desglose_wompi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_pct numeric;
  v_iva_pct numeric;
  v_bruto numeric;
BEGIN
  -- Si no se especificó valor_bruto, usar valor
  IF NEW.valor_bruto IS NULL THEN
    NEW.valor_bruto := NEW.valor;
  END IF;

  IF NEW.metodo_pago = 'wompi' THEN
    SELECT (valor#>>'{}')::numeric INTO v_fee_pct FROM public.parametros_financieros WHERE clave = 'fee_wompi_porcentaje';
    SELECT (valor#>>'{}')::numeric INTO v_iva_pct FROM public.parametros_financieros WHERE clave = 'iva_fee_wompi_porcentaje';
    v_fee_pct := COALESCE(v_fee_pct, 0);
    v_iva_pct := COALESCE(v_iva_pct, 0);
    v_bruto := COALESCE(NEW.valor_bruto, NEW.valor, 0);

    IF NEW.fee_wompi IS NULL OR NEW.fee_wompi = 0 THEN
      NEW.fee_wompi := ROUND(v_bruto * v_fee_pct / 100, 2);
    END IF;
    IF NEW.iva_fee IS NULL OR NEW.iva_fee = 0 THEN
      NEW.iva_fee := ROUND(NEW.fee_wompi * v_iva_pct / 100, 2);
    END IF;
    IF NEW.valor_neto IS NULL THEN
      NEW.valor_neto := v_bruto - NEW.fee_wompi - NEW.iva_fee;
    END IF;
  ELSE
    IF NEW.valor_neto IS NULL THEN
      NEW.valor_neto := COALESCE(NEW.valor_bruto, NEW.valor);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desglose_wompi ON public.cartera_pagos;
CREATE TRIGGER trg_desglose_wompi
  BEFORE INSERT OR UPDATE ON public.cartera_pagos
  FOR EACH ROW EXECUTE FUNCTION public.calcular_desglose_wompi();