DROP VIEW IF EXISTS public.profiles_publicos;

CREATE VIEW public.profiles_publicos
WITH (security_invoker = on) AS
SELECT
  id,
  nombre,
  email,
  activo,
  pais,
  ciudad,
  celular,
  whatsapp,
  correo_corporativo,
  avatar_url,
  avatar_path,
  equipo,
  sede,
  rol_solicitado,
  estado_acceso,
  last_seen_at,
  presencia_visible,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_publicos TO authenticated;
GRANT SELECT ON public.profiles_publicos TO service_role;

DROP POLICY IF EXISTS "Authenticated users read visible role labels" ON public.user_roles;
DROP POLICY IF EXISTS "Users read own roles or admin reads all" ON public.user_roles;

CREATE POLICY "Users read own roles or admin reads all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
);

CREATE OR REPLACE FUNCTION public.list_colaboradores_publicos()
RETURNS TABLE (
  user_id uuid,
  nombre text,
  correo text,
  correo_corp text,
  whatsapp text,
  celular text,
  ciudad text,
  pais text,
  equipo text,
  sede text,
  foto_url text,
  activo boolean,
  roles text[],
  roles_raw text[],
  last_seen_at timestamptz,
  presencia_visible boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.nombre,
    p.email AS correo,
    p.correo_corporativo AS correo_corp,
    p.whatsapp,
    p.celular,
    p.ciudad,
    p.pais,
    p.equipo,
    p.sede,
    p.avatar_url AS foto_url,
    COALESCE(p.activo, true) AS activo,
    CASE
      WHEN COALESCE(array_length(role_data.roles_raw, 1), 0) > 0 THEN role_data.roles_raw
      WHEN p.rol_solicitado IS NOT NULL THEN ARRAY[p.rol_solicitado::text]
      ELSE ARRAY[]::text[]
    END AS roles,
    CASE
      WHEN COALESCE(array_length(role_data.roles_raw, 1), 0) > 0 THEN role_data.roles_raw
      WHEN p.rol_solicitado IS NOT NULL THEN ARRAY[p.rol_solicitado::text]
      ELSE ARRAY[]::text[]
    END AS roles_raw,
    p.last_seen_at,
    COALESCE(p.presencia_visible, true) AS presencia_visible
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT array_agg(ur.role::text ORDER BY ur.role::text) AS roles_raw
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
  ) role_data ON true
  WHERE auth.uid() IS NOT NULL
    AND COALESCE(p.activo, true) = true
    AND COALESCE(p.estado_acceso, 'aprobado') = 'aprobado'
  ORDER BY p.nombre NULLS LAST, p.email NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_colaboradores_publicos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_colaboradores_publicos() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_colaboradores_publicos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_colaboradores_publicos() TO service_role;