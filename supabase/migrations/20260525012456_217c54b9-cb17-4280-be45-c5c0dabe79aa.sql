ALTER TABLE public.cuentas_cobro
  ADD COLUMN IF NOT EXISTS porcentaje_comision numeric(5,2);

ALTER TABLE public.cuentas_cobro
  DROP CONSTRAINT IF EXISTS cuentas_cobro_porcentaje_comision_check;

ALTER TABLE public.cuentas_cobro
  ADD CONSTRAINT cuentas_cobro_porcentaje_comision_check
  CHECK (porcentaje_comision IS NULL OR porcentaje_comision IN (35, 40, 45, 50));