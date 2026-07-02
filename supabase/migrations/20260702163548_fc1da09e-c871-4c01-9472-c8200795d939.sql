CREATE OR REPLACE FUNCTION public.colab_es_revisor_qa(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user, 'super_admin'::app_role)
    OR public.has_role(_user, 'gerencia'::app_role)
    OR public.has_role(_user, 'director_financiero_qa'::app_role)
    OR public.has_role(_user, 'operaciones'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.colab_puede_ver_canal(_canal uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.colab_canales c
    WHERE c.id = _canal
      AND (
        NOT c.privado
        OR c.created_by = _user
        OR public.colab_es_miembro(_canal, _user)
        OR public.has_role(_user, 'super_admin'::app_role)
        OR (c.tipo = 'qa_auditoria' AND public.colab_es_revisor_qa(_user))
      )
  );
$$;

DROP POLICY IF EXISTS "canales select" ON public.colab_canales;
CREATE POLICY "canales select" ON public.colab_canales FOR SELECT TO authenticated
  USING (
    NOT privado
    OR created_by = auth.uid()
    OR colab_es_miembro(id, auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR (tipo = 'qa_auditoria' AND public.colab_es_revisor_qa(auth.uid()))
  );

DROP POLICY IF EXISTS "miembros insert" ON public.colab_miembros;
CREATE POLICY "miembros insert" ON public.colab_miembros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.colab_canales c WHERE c.id = canal_id AND c.created_by = auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.colab_canales c
      WHERE c.id = canal_id
        AND c.tipo = 'qa_auditoria'
        AND public.colab_es_revisor_qa(auth.uid())
    )
  );
