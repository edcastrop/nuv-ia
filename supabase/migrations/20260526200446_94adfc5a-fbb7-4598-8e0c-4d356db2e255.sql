
-- ===== ONBOARDING V1 NUVEX =====

-- 1) Profiles: campos onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_estado text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS onboarding_paso integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bienvenida_vista boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perfil_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS academia_asignada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_completo boolean NOT NULL DEFAULT false;

-- 2) onboarding_config (singleton)
CREATE TABLE IF NOT EXISTS public.onboarding_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  video_bienvenida_url text,
  mensaje_bienvenida text NOT NULL DEFAULT 'Bienvenido a NUVEX. Nos alegra tenerte en el equipo.',
  descripcion_empresa text NOT NULL DEFAULT 'NUVEX es una plataforma de finanzas inteligentes que acompaña a sus colaboradores con tecnología, capacitación y soporte continuo.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.onboarding_config TO authenticated;
GRANT ALL ON public.onboarding_config TO service_role;

ALTER TABLE public.onboarding_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config select authenticated"
ON public.onboarding_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "config manage super_admin"
ON public.onboarding_config FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.onboarding_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 3) onboarding_auditoria
CREATE TABLE IF NOT EXISTS public.onboarding_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  evento text NOT NULL,
  actor_id uuid,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onb_aud_user ON public.onboarding_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_onb_aud_evento ON public.onboarding_auditoria(evento);

GRANT SELECT, INSERT ON public.onboarding_auditoria TO authenticated;
GRANT ALL ON public.onboarding_auditoria TO service_role;

ALTER TABLE public.onboarding_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb aud insert self or admin"
ON public.onboarding_auditoria FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR actor_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
);

CREATE POLICY "onb aud select admin or self"
ON public.onboarding_auditoria FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4) Trigger: cuando estado_acceso pasa a 'activo', iniciar onboarding + auditar
CREATE OR REPLACE FUNCTION public.on_profile_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado_acceso::text = 'activo' AND COALESCE(OLD.estado_acceso::text,'') <> 'activo' THEN
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

DROP TRIGGER IF EXISTS trg_on_profile_approved ON public.profiles;
CREATE TRIGGER trg_on_profile_approved
BEFORE UPDATE OF estado_acceso ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_profile_approved();
