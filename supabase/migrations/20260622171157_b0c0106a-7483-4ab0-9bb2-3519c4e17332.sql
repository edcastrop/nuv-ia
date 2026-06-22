DROP POLICY IF EXISTS "Destinatarios insert admin/gerencia" ON public.contratacion_destinatarios;
DROP POLICY IF EXISTS "Destinatarios update admin/gerencia" ON public.contratacion_destinatarios;
DROP POLICY IF EXISTS "Destinatarios delete admin/gerencia" ON public.contratacion_destinatarios;

CREATE POLICY "Destinatarios insert autenticados" ON public.contratacion_destinatarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Destinatarios update autenticados" ON public.contratacion_destinatarios
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Destinatarios delete admin/gerencia" ON public.contratacion_destinatarios
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role));