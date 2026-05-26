
-- 1. Ampliar profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_documento text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'Colombia',
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS celular text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS correo_corporativo text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS fecha_ingreso date,
  ADD COLUMN IF NOT EXISTS coordinador_id uuid,
  ADD COLUMN IF NOT EXISTS equipo text,
  ADD COLUMN IF NOT EXISTS sede text,
  ADD COLUMN IF NOT EXISTS porcentaje_comision numeric(5,2),
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS tipo_cuenta text,
  ADD COLUMN IF NOT EXISTS numero_cuenta text,
  ADD COLUMN IF NOT EXISTS titular_cuenta text;

-- 2. Helper: puede ver datos financieros del perfil?
CREATE OR REPLACE FUNCTION public.can_view_profile_finanzas(_uid uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid = _profile_id
      OR public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'contabilidad'::app_role);
$$;

-- 3. Ampliar lectura de profiles a todos los autenticados (sólo datos básicos vía vista)
DROP POLICY IF EXISTS "Profiles viewable basic by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable basic by authenticated"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- 4. Vista pública sin datos financieros
CREATE OR REPLACE VIEW public.profiles_publicos AS
SELECT id, nombre, email, activo, tipo_documento, numero_documento,
       pais, departamento, ciudad, direccion, celular, whatsapp,
       correo_corporativo, avatar_url, avatar_path,
       fecha_ingreso, coordinador_id, equipo, sede,
       created_at, updated_at
FROM public.profiles;

-- 5. Tabla de auditoría de perfiles
CREATE TABLE IF NOT EXISTS public.profile_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  actor_id uuid,
  accion text NOT NULL,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_aud_profile ON public.profile_auditoria(profile_id, created_at DESC);

ALTER TABLE public.profile_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PA select propio o manager" ON public.profile_auditoria;
CREATE POLICY "PA select propio o manager"
ON public.profile_auditoria FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'gerencia'::app_role)
);

DROP POLICY IF EXISTS "PA insert auth" ON public.profile_auditoria;
CREATE POLICY "PA insert auth"
ON public.profile_auditoria FOR INSERT TO authenticated
WITH CHECK (true);

-- 6. Trigger: cambios en profiles
CREATE OR REPLACE FUNCTION public.trg_profile_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_nuevo)
    VALUES (NEW.id, NEW.id, 'creado',
      jsonb_build_object('nombre', NEW.nombre, 'email', NEW.email));
    RETURN NEW;
  END IF;

  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_anterior, valor_nuevo)
    VALUES (NEW.id, auth.uid(), 'cambio_foto',
      jsonb_build_object('avatar_url', OLD.avatar_url),
      jsonb_build_object('avatar_url', NEW.avatar_url));
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.correo_corporativo IS DISTINCT FROM OLD.correo_corporativo THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_anterior, valor_nuevo)
    VALUES (NEW.id, auth.uid(), 'cambio_correo',
      jsonb_build_object('email', OLD.email, 'correo_corporativo', OLD.correo_corporativo),
      jsonb_build_object('email', NEW.email, 'correo_corporativo', NEW.correo_corporativo));
  END IF;
  IF NEW.celular IS DISTINCT FROM OLD.celular
     OR NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_anterior, valor_nuevo)
    VALUES (NEW.id, auth.uid(), 'cambio_celular',
      jsonb_build_object('celular', OLD.celular, 'whatsapp', OLD.whatsapp),
      jsonb_build_object('celular', NEW.celular, 'whatsapp', NEW.whatsapp));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_audit ON public.profiles;
CREATE TRIGGER trg_profiles_audit
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profile_auditoria();

-- 7. Trigger: cambios de rol
CREATE OR REPLACE FUNCTION public.trg_user_roles_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_nuevo)
    VALUES (NEW.user_id, auth.uid(), 'cambio_rol',
      jsonb_build_object('rol_agregado', NEW.role::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.profile_auditoria(profile_id, actor_id, accion, valor_anterior)
    VALUES (OLD.user_id, auth.uid(), 'cambio_rol',
      jsonb_build_object('rol_removido', OLD.role::text));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_audit
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.trg_user_roles_auditoria();

-- 8. Storage bucket avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars owner insert" ON storage.objects;
CREATE POLICY "Avatars owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatars owner delete" ON storage.objects;
CREATE POLICY "Avatars owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
