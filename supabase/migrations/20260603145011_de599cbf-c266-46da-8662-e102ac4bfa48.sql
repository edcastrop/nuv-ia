UPDATE public.profiles
SET
  fecha_ingreso = COALESCE(fecha_ingreso, aprobado_at::date, created_at::date),
  equipo = COALESCE(NULLIF(equipo, ''), NULLIF(equipo_registro, '')),
  sede = COALESCE(NULLIF(sede, ''), NULLIF(ciudad, ''), NULLIF(ciudad_registro, ''))
WHERE estado_acceso::text IN ('aprobado', 'activo')
  AND (
    fecha_ingreso IS NULL
    OR NULLIF(equipo, '') IS NULL
    OR NULLIF(sede, '') IS NULL
  );

CREATE OR REPLACE FUNCTION public.trg_profiles_organizacional_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado_acceso::text IN ('aprobado', 'activo') THEN
    NEW.fecha_ingreso := COALESCE(NEW.fecha_ingreso, NEW.aprobado_at::date, now()::date);
    NEW.equipo := COALESCE(NULLIF(NEW.equipo, ''), NULLIF(NEW.equipo_registro, ''));
    NEW.sede := COALESCE(NULLIF(NEW.sede, ''), NULLIF(NEW.ciudad, ''), NULLIF(NEW.ciudad_registro, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_organizacional_defaults ON public.profiles;
CREATE TRIGGER profiles_organizacional_defaults
BEFORE INSERT OR UPDATE OF estado_acceso, aprobado_at, fecha_ingreso, equipo, equipo_registro, sede, ciudad, ciudad_registro
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_profiles_organizacional_defaults();