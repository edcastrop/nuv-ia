DROP POLICY IF EXISTS "Apoderados insert admin/gerencia" ON public.apoderados_nuvex;
DROP POLICY IF EXISTS "Apoderados update admin/gerencia" ON public.apoderados_nuvex;
DROP POLICY IF EXISTS "Apoderados delete admin/gerencia" ON public.apoderados_nuvex;

CREATE POLICY "Apoderados insert super_admin"
  ON public.apoderados_nuvex FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Apoderados update super_admin"
  ON public.apoderados_nuvex FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Apoderados delete super_admin"
  ON public.apoderados_nuvex FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));