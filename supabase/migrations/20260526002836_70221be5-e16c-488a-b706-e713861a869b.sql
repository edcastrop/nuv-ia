
-- =====================================================================
-- 1. ENUMS
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director_financiero_qa';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director_juridico';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auxiliar_operativo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'apoderado';

ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'proyeccion_pendiente_qa';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'proyeccion_aprobada_qa';
ALTER TYPE public.caso_estado ADD VALUE IF NOT EXISTS 'proyeccion_devuelta_qa';
