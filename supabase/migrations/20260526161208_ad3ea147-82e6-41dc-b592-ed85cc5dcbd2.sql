
-- Enums
DO $$ BEGIN
  CREATE TYPE public.acceso_estado AS ENUM ('pendiente','aprobado','rechazado','bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mfa_metodo AS ENUM ('ninguno','email','totp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS estado_acceso public.acceso_estado NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS rol_solicitado text,
  ADD COLUMN IF NOT EXISTS telefono_registro text,
  ADD COLUMN IF NOT EXISTS ciudad_registro text,
  ADD COLUMN IF NOT EXISTS equipo_registro text,
  ADD COLUMN IF NOT EXISTS aprobado_por uuid,
  ADD COLUMN IF NOT EXISTS aprobado_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazado_motivo text,
  ADD COLUMN IF NOT EXISTS ultimo_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS intentos_fallidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mfa_requerido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mfa_metodo public.mfa_metodo NOT NULL DEFAULT 'ninguno',
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_verificado_at timestamptz;

-- Backfill existing profiles to 'aprobado' so current users no son bloqueados
UPDATE public.profiles SET estado_acceso = 'aprobado' WHERE estado_acceso = 'pendiente' AND created_at < now();

-- Auditoría de accesos
CREATE TABLE IF NOT EXISTS public.acceso_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  accion text NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acceso_auditoria_user ON public.acceso_auditoria(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.acceso_auditoria TO authenticated;
GRANT ALL ON public.acceso_auditoria TO service_role;

ALTER TABLE public.acceso_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceso_aud_select_admin" ON public.acceso_auditoria
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
    OR user_id = auth.uid()
  );

CREATE POLICY "acceso_aud_insert_self_or_admin" ON public.acceso_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
  );

-- Códigos MFA por email
CREATE TABLE IF NOT EXISTS public.mfa_codigos_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  codigo_hash text NOT NULL,
  expira_at timestamptz NOT NULL,
  usado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_codigos_user ON public.mfa_codigos_email(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mfa_codigos_email TO authenticated;
GRANT ALL ON public.mfa_codigos_email TO service_role;

ALTER TABLE public.mfa_codigos_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_cod_self" ON public.mfa_codigos_email
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Modificar handle_new_user para dejar pendiente y guardar metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, nombre, email,
    telefono_registro, ciudad_registro, equipo_registro,
    rol_solicitado, estado_acceso
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono',
    NEW.raw_user_meta_data->>'ciudad',
    NEW.raw_user_meta_data->>'equipo',
    NEW.raw_user_meta_data->>'rol_solicitado',
    'pendiente'::public.acceso_estado
  );
  -- No asignar rol por defecto: queda sin rol hasta aprobación
  INSERT INTO public.acceso_auditoria(user_id, actor_id, accion, detalle)
  VALUES (NEW.id, NEW.id, 'cuenta_creada',
    jsonb_build_object(
      'rol_solicitado', NEW.raw_user_meta_data->>'rol_solicitado',
      'ciudad', NEW.raw_user_meta_data->>'ciudad'
    ));
  RETURN NEW;
END;
$function$;

-- Política adicional para que admin pueda actualizar estado_acceso en profiles
DROP POLICY IF EXISTS "profiles_update_admin_acceso" ON public.profiles;
CREATE POLICY "profiles_update_admin_acceso" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
  );
