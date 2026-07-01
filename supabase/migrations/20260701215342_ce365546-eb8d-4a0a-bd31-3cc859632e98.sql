DROP POLICY IF EXISTS ep_delete_exp ON public.expediente_proyecciones;

CREATE POLICY ep_delete_exp
ON public.expediente_proyecciones
FOR DELETE
TO authenticated
USING (public.can_access_expediente(auth.uid(), expediente_id));