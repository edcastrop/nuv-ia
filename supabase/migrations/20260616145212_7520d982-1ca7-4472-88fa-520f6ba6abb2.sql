
-- Iter 6: Cierre de hallazgos de seguridad (perfiles, exámenes, certificaciones, testimonios, buckets)

-- 1) PROFILES: quitar lectura abierta de todo el perfil a cualquier autenticado.
-- Los pares acceden a datos no sensibles vía la vista public.profiles_publicos (security_invoker).
DROP POLICY IF EXISTS "Profiles viewable basic by authenticated" ON public.profiles;

-- 2) ACADEMIA_PREGUNTAS: ocultar columna respuesta_correcta a usuarios autenticados.
-- Solo super_admin/gerencia pueden leerla (vía rol que ya tiene ALL) usando vista server-side o RPC.
REVOKE SELECT (respuesta_correcta) ON public.academia_preguntas FROM authenticated;
-- Mantener acceso al resto de columnas para que los usuarios puedan responder.

-- 3) ACADEMIA_CERTIFICACIONES: quitar SELECT abierto.
DROP POLICY IF EXISTS "Cert select por codigo" ON public.academia_certificaciones;
-- Queda activa "Cert select propio o manager" (owner + super_admin + gerencia).

-- 4) TESTIMONIOS: restringir lectura y escritura.
DROP POLICY IF EXISTS "testimonios_read_auth" ON public.testimonios;
DROP POLICY IF EXISTS "testimonios_write_auth" ON public.testimonios;

CREATE POLICY "testimonios_select_scoped" ON public.testimonios
  FOR SELECT TO authenticated
  USING (
    capturado_por = auth.uid()
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gerencia'::app_role)
  );

CREATE POLICY "testimonios_write_scoped" ON public.testimonios
  FOR ALL TO authenticated
  USING (
    capturado_por = auth.uid()
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gerencia'::app_role)
  )
  WITH CHECK (
    capturado_por = auth.uid()
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gerencia'::app_role)
  );

-- 5) STORAGE: bucket capacidad-pago-docs — validar ownership por expediente (folder[1]).
DROP POLICY IF EXISTS "auth read capacidad docs" ON storage.objects;
DROP POLICY IF EXISTS "auth insert capacidad docs" ON storage.objects;
DROP POLICY IF EXISTS "auth update capacidad docs" ON storage.objects;
DROP POLICY IF EXISTS "auth delete capacidad docs" ON storage.objects;

CREATE POLICY "capacidad docs select scoped" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'capacidad-pago-docs'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "capacidad docs insert scoped" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'capacidad-pago-docs'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "capacidad docs update scoped" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'capacidad-pago-docs'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'capacidad-pago-docs'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "capacidad docs delete scoped" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'capacidad-pago-docs'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 6) STORAGE: bucket proyecciones-banco — mismo patrón.
DROP POLICY IF EXISTS "auth read proyecciones bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth insert proyecciones bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth update proyecciones bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth delete proyecciones bucket" ON storage.objects;

CREATE POLICY "proyecciones bucket select scoped" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'proyecciones-banco'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "proyecciones bucket insert scoped" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proyecciones-banco'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "proyecciones bucket update scoped" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proyecciones-banco'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'proyecciones-banco'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "proyecciones bucket delete scoped" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'proyecciones-banco'
    AND public.can_access_expediente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 7) STORAGE: colab-adjuntos — SELECT restringido al subidor o miembros del canal (folder[2] = canal_id).
DROP POLICY IF EXISTS "colab adjuntos select" ON storage.objects;
CREATE POLICY "colab adjuntos select scoped" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'colab-adjuntos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.colab_puede_ver_canal(((storage.foldername(name))[2])::uuid, auth.uid())
      OR has_role(auth.uid(),'super_admin'::app_role)
    )
  );
