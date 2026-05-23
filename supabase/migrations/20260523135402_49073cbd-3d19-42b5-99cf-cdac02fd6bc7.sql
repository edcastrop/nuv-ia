-- Enum 19 estados del caso
DO $$ BEGIN
  CREATE TYPE public.caso_estado AS ENUM (
    'lead_creado','extracto_recibido','simulacion_realizada','propuesta_presentada',
    'negociacion','pendiente_contratacion','enviado_contratacion','contrato_enviado',
    'contrato_firmado','poder_firmado','radicacion_pendiente','radicado_banco',
    'en_estudio_banco','aprobado','resultado_final_generado','cuenta_cobro_enviada',
    'honorarios_pagados','paz_y_salvo_generado','proceso_cerrado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS estado_caso public.caso_estado NOT NULL DEFAULT 'lead_creado';

ALTER TABLE public.expediente_historial
  ADD COLUMN IF NOT EXISTS estado_caso_anterior public.caso_estado,
  ADD COLUMN IF NOT EXISTS estado_caso_nuevo public.caso_estado,
  ADD COLUMN IF NOT EXISTS accion_origen text,
  ADD COLUMN IF NOT EXISTS observacion text;

ALTER TABLE public.expediente_historial
  ALTER COLUMN estado_nuevo DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- expedientes RLS super_admin
DROP POLICY IF EXISTS "Super admin sees all expedientes" ON public.expedientes;
CREATE POLICY "Super admin sees all expedientes" ON public.expedientes
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Super admin updates all expedientes" ON public.expedientes;
CREATE POLICY "Super admin updates all expedientes" ON public.expedientes
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Super admin deletes all expedientes" ON public.expedientes;
CREATE POLICY "Super admin deletes all expedientes" ON public.expedientes
  FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- profiles RLS super_admin
DROP POLICY IF EXISTS "Super admin views all profiles" ON public.profiles;
CREATE POLICY "Super admin views all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Super admin updates all profiles" ON public.profiles;
CREATE POLICY "Super admin updates all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

-- user_roles
DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Super admin manages roles" ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- historial
DROP POLICY IF EXISTS "Super admin views all historial" ON public.expediente_historial;
CREATE POLICY "Super admin views all historial" ON public.expediente_historial
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Super admin inserts historial" ON public.expediente_historial;
CREATE POLICY "Super admin inserts historial" ON public.expediente_historial
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));