
-- Trigger: marcar perfil_completo automáticamente cuando los campos clave están llenos
CREATE OR REPLACE FUNCTION public.trg_profiles_marcar_perfil_completo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.perfil_completo, false) = false
     AND NULLIF(trim(COALESCE(NEW.nombre,'')),'') IS NOT NULL
     AND NULLIF(trim(COALESCE(NEW.celular,'')),'') IS NOT NULL
     AND NULLIF(trim(COALESCE(NEW.ciudad,'')),'') IS NOT NULL
     AND NULLIF(trim(COALESCE(NEW.pais,'')),'') IS NOT NULL
  THEN
    NEW.perfil_completo := true;
    IF NEW.onboarding_estado IS NULL OR NEW.onboarding_estado = 'pendiente' THEN
      NEW.onboarding_estado := 'en_progreso';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_marcar_perfil_completo_iu ON public.profiles;
CREATE TRIGGER trg_profiles_marcar_perfil_completo_iu
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_marcar_perfil_completo();

-- Backfill: perfiles existentes que ya cumplen requisitos
UPDATE public.profiles
SET perfil_completo = true
WHERE COALESCE(perfil_completo,false) = false
  AND NULLIF(trim(COALESCE(nombre,'')),'') IS NOT NULL
  AND NULLIF(trim(COALESCE(celular,'')),'') IS NOT NULL
  AND NULLIF(trim(COALESCE(ciudad,'')),'') IS NOT NULL
  AND NULLIF(trim(COALESCE(pais,'')),'') IS NOT NULL;
