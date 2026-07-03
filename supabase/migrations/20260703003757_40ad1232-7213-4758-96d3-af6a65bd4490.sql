DROP VIEW IF EXISTS public.profiles_publicos;

CREATE VIEW public.profiles_publicos
WITH (security_invoker = false, security_barrier = true) AS
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
FROM public.profiles
WHERE COALESCE(activo, true) = true
  AND COALESCE(estado_acceso, 'aprobado') = 'aprobado';

GRANT SELECT ON public.profiles_publicos TO authenticated;
GRANT SELECT ON public.profiles_publicos TO service_role;

DROP POLICY IF EXISTS "Users read own roles or admin reads all" ON public.user_roles;

CREATE POLICY "Authenticated users read visible role labels"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);