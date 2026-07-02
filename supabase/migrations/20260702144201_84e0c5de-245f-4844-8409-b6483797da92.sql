DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
CREATE POLICY "Profiles viewable"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR has_role(auth.uid(), 'director_financiero_qa'::app_role)
  OR has_role(auth.uid(), 'director_juridico'::app_role)
);