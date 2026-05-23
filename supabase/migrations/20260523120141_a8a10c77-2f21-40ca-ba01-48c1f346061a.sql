CREATE TABLE public.apoderados_nuvex (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL,
  lugar_expedicion TEXT,
  celular TEXT,
  correo TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.apoderados_nuvex ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apoderados visibles para autenticados"
ON public.apoderados_nuvex FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apoderados insert admin/gerencia"
ON public.apoderados_nuvex FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role));

CREATE POLICY "Apoderados update admin/gerencia"
ON public.apoderados_nuvex FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role));

CREATE POLICY "Apoderados delete admin/gerencia"
ON public.apoderados_nuvex FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role));

CREATE TRIGGER apoderados_nuvex_updated_at
BEFORE UPDATE ON public.apoderados_nuvex
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();