CREATE TABLE IF NOT EXISTS public.onboarding_notif_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  canal text NOT NULL,
  email_destino text,
  asunto text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_at timestamptz NOT NULL DEFAULT now(),
  procesado_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_onb_notif_user ON public.onboarding_notif_log(user_id);
CREATE INDEX IF NOT EXISTS idx_onb_notif_pendiente ON public.onboarding_notif_log(enviado_at) WHERE procesado_at IS NULL AND canal = 'email';
CREATE INDEX IF NOT EXISTS idx_onb_notif_user_etapa ON public.onboarding_notif_log(user_id, etapa, enviado_at);

GRANT SELECT ON public.onboarding_notif_log TO authenticated;
GRANT ALL ON public.onboarding_notif_log TO service_role;
ALTER TABLE public.onboarding_notif_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve su log onboarding"
ON public.onboarding_notif_log FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.calcular_etapa_onboarding(_user_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estado text; v_perfil_ok boolean; v_mfa_metodo text;
BEGIN
  SELECT estado_acceso::text, perfil_completo, mfa_metodo::text
    INTO v_estado, v_perfil_ok, v_mfa_metodo
  FROM public.profiles WHERE id = _user_id;
  IF v_estado IS NULL THEN RETURN 'desconocido'; END IF;
  IF v_estado = 'desvinculado' THEN RETURN 'desvinculado'; END IF;
  IF v_estado NOT IN ('aprobado','activo') THEN RETURN 'pendiente_aprobacion'; END IF;
  IF NOT COALESCE(v_perfil_ok, false) THEN RETURN 'pendiente_perfil'; END IF;
  IF v_mfa_metodo IS NULL OR v_mfa_metodo = '' THEN RETURN 'pendiente_mfa'; END IF;
  RETURN 'completo';
END $$;

CREATE OR REPLACE FUNCTION public.registrar_notif_onboarding(
  _user_id uuid, _etapa text, _canal text,
  _asunto text DEFAULT NULL, _meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_email text; v_ya boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.onboarding_notif_log
    WHERE user_id = _user_id AND etapa = _etapa AND canal = _canal
      AND enviado_at >= date_trunc('day', now())
  ) INTO v_ya;
  IF v_ya THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(correo_corporativo,''), email) INTO v_email
  FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.onboarding_notif_log(user_id, etapa, canal, email_destino, asunto, metadata)
  VALUES (_user_id, _etapa, _canal, v_email, _asunto, _meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_onboarding_etapas_notif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nombre text;
BEGIN
  v_nombre := COALESCE(NULLIF(NEW.nombre,''), NEW.email, 'colaborador');

  IF (NEW.estado_acceso::text IN ('aprobado','activo'))
     AND (OLD.estado_acceso::text NOT IN ('aprobado','activo')) THEN
    PERFORM public.registrar_notif_onboarding(NEW.id, 'aprobado', 'email',
      'Tu cuenta NUVEX fue aprobada — siguientes pasos',
      jsonb_build_object('nombre', v_nombre));
    PERFORM public.notify_user(NEW.id, 'onboarding_aprobado',
      '¡Cuenta aprobada!',
      'Completa tu perfil y activa la autenticación de doble factor para terminar.',
      '/onboarding', 'alta', '{}'::jsonb);
  END IF;

  IF COALESCE(NEW.perfil_completo,false) = true
     AND COALESCE(OLD.perfil_completo,false) = false THEN
    PERFORM public.registrar_notif_onboarding(NEW.id, 'perfil_completado', 'email',
      'Perfil completo — falta activar tu MFA',
      jsonb_build_object('nombre', v_nombre));
    PERFORM public.notify_user(NEW.id, 'onboarding_perfil',
      'Perfil completado',
      'Solo falta activar tu autenticación de doble factor para finalizar.',
      '/mi-perfil', 'alta', '{}'::jsonb);
  END IF;

  IF NEW.mfa_metodo IS NOT NULL
     AND (OLD.mfa_metodo IS NULL OR OLD.mfa_metodo::text = '') THEN
    PERFORM public.registrar_notif_onboarding(NEW.id, 'mfa_activado', 'email',
      '¡Tu cuenta NUVEX está completamente activa!',
      jsonb_build_object('nombre', v_nombre, 'metodo', NEW.mfa_metodo::text));
    PERFORM public.notify_user(NEW.id, 'onboarding_completo',
      'Configuración finalizada',
      'Tu cuenta está totalmente activa y protegida.',
      '/', 'media', '{}'::jsonb);
    NEW.onboarding_estado := 'completado';
    NEW.onboarding_completed_at := COALESCE(NEW.onboarding_completed_at, now());
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_onboarding_etapas_notif_upd ON public.profiles;
CREATE TRIGGER trg_onboarding_etapas_notif_upd
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_onboarding_etapas_notif();

CREATE OR REPLACE FUNCTION public.trg_onboarding_bienvenida_nuevo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.registrar_notif_onboarding(NEW.id, 'bienvenida', 'email',
    'Bienvenido a NUVEX — tu cuenta está siendo revisada',
    jsonb_build_object('nombre', COALESCE(NULLIF(NEW.nombre,''), NEW.email)));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_onboarding_bienvenida_ins ON public.profiles;
CREATE TRIGGER trg_onboarding_bienvenida_ins
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_onboarding_bienvenida_nuevo();

CREATE OR REPLACE FUNCTION public.procesar_recordatorios_onboarding()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user record; v_etapa text; v_dias int;
  v_recordatorios int := 0; v_alertas_admin int := 0;
BEGIN
  FOR v_user IN
    SELECT p.id, p.nombre, p.email, p.correo_corporativo, p.created_at
    FROM public.profiles p
    WHERE p.estado_acceso::text <> 'desvinculado'
      AND (p.onboarding_estado IS DISTINCT FROM 'completado' OR p.mfa_metodo IS NULL)
      AND p.created_at > now() - interval '90 days'
  LOOP
    v_etapa := public.calcular_etapa_onboarding(v_user.id);
    IF v_etapa IN ('completo','desvinculado') THEN CONTINUE; END IF;
    v_dias := EXTRACT(DAY FROM (now() - v_user.created_at))::int;

    IF public.registrar_notif_onboarding(v_user.id, 'recordatorio_diario', 'email',
        'Aún no has terminado de configurar tu cuenta NUVEX',
        jsonb_build_object('etapa', v_etapa, 'dias', v_dias)) IS NOT NULL THEN
      v_recordatorios := v_recordatorios + 1;
      PERFORM public.notify_user(v_user.id, 'onboarding_recordatorio',
        'Termina de configurar tu cuenta',
        'Llevas ' || v_dias || ' día(s) sin completar. Etapa pendiente: ' || v_etapa,
        CASE v_etapa
          WHEN 'pendiente_aprobacion' THEN '/pendiente-aprobacion'
          WHEN 'pendiente_perfil' THEN '/mi-perfil'
          WHEN 'pendiente_mfa' THEN '/mi-perfil'
          ELSE '/onboarding'
        END, 'media',
        jsonb_build_object('etapa', v_etapa, 'dias', v_dias));
    END IF;

    IF v_dias >= 7 THEN
      IF public.registrar_notif_onboarding(v_user.id, 'alerta_admin_7d', 'admin',
          'Usuario sin completar onboarding (+7 días)',
          jsonb_build_object('etapa', v_etapa, 'dias', v_dias, 'nombre', v_user.nombre)) IS NOT NULL THEN
        v_alertas_admin := v_alertas_admin + 1;
        PERFORM public.notify_role('super_admin'::app_role,
          'onboarding_abandonado',
          'Usuario no ha terminado configuración',
          COALESCE(v_user.nombre, v_user.email) || ' lleva ' || v_dias || ' días sin completar. Etapa: ' || v_etapa,
          '/super-admin/accesos', 'alta',
          jsonb_build_object('user_id', v_user.id, 'etapa', v_etapa, 'dias', v_dias));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'recordatorios_creados', v_recordatorios,
    'alertas_admin', v_alertas_admin,
    'timestamp', now()
  );
END $$;