-- Entrega 3: add comprobante_url to cuentas_cobro for payment receipt
ALTER TABLE public.cuentas_cobro
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT;