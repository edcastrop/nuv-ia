
DROP VIEW IF EXISTS public.profiles_publicos;
CREATE VIEW public.profiles_publicos
WITH (security_invoker=on) AS
SELECT id, nombre, email, activo, tipo_documento, numero_documento, pais, departamento,
       ciudad, direccion, celular, whatsapp, correo_corporativo, avatar_url, avatar_path,
       fecha_ingreso, coordinador_id, equipo, sede, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_publicos TO authenticated;
