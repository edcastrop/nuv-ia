
CREATE OR REPLACE FUNCTION public.on_profile_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado_acceso::text = 'aprobado' AND COALESCE(OLD.estado_acceso::text,'') <> 'aprobado' THEN
    IF NEW.onboarding_estado = 'pendiente' THEN
      NEW.onboarding_estado := 'en_progreso';
      NEW.onboarding_started_at := now();
      NEW.academia_asignada := true;
    END IF;
    INSERT INTO public.onboarding_auditoria(user_id, evento, actor_id, detalle)
    VALUES (NEW.id, 'aprobacion', auth.uid(), jsonb_build_object('rol_solicitado', NEW.rol_solicitado));
  ELSIF NEW.estado_acceso::text = 'rechazado' AND COALESCE(OLD.estado_acceso::text,'') <> 'rechazado' THEN
    INSERT INTO public.onboarding_auditoria(user_id, evento, actor_id, detalle)
    VALUES (NEW.id, 'rechazo', auth.uid(), jsonb_build_object('motivo', NEW.rechazado_motivo));
  END IF;
  RETURN NEW;
END;
$$;
