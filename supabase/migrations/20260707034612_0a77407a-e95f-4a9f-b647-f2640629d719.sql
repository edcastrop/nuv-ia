-- Soporte para Leasing Habitacional en el simulador NUVEX (campos aditivos)
ALTER TABLE public.expediente_maestro
  ADD COLUMN IF NOT EXISTS tipo_producto text NOT NULL DEFAULT 'hipotecario',
  ADD COLUMN IF NOT EXISTS valor_residual numeric,
  ADD COLUMN IF NOT EXISTS incluir_opcion_compra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sistema_amortizacion text;

ALTER TABLE public.expediente_maestro
  ADD CONSTRAINT expediente_maestro_tipo_producto_chk
    CHECK (tipo_producto IN ('hipotecario','leasing_habitacional'));

ALTER TABLE public.proyecciones_financieras
  ADD COLUMN IF NOT EXISTS tipo_producto text NOT NULL DEFAULT 'hipotecario',
  ADD COLUMN IF NOT EXISTS valor_residual numeric,
  ADD COLUMN IF NOT EXISTS incluir_opcion_compra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sistema_amortizacion text;

ALTER TABLE public.proyecciones_financieras
  ADD CONSTRAINT proyecciones_financieras_tipo_producto_chk
    CHECK (tipo_producto IN ('hipotecario','leasing_habitacional'));
