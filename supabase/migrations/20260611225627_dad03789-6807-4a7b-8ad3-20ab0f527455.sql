-- FASE 7.6.1D-1: Tareas, Bitácora, helper RLS, backfill Cliente Maestro

-- 1) Enums
CREATE TYPE public.tarea_prioridad AS ENUM ('baja','media','alta','critica');
CREATE TYPE public.tarea_estado    AS ENUM ('pendiente','en_progreso','completada','cancelada');
CREATE TYPE public.bitacora_tipo   AS ENUM ('comentario','evidencia','llamada','email','whatsapp','sistema');

-- 2) expediente_tareas
CREATE TABLE public.expediente_tareas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  responsable_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  prioridad       public.tarea_prioridad NOT NULL DEFAULT 'media',
  fecha_objetivo  date,
  estado          public.tarea_estado    NOT NULL DEFAULT 'pendiente',
  completada_at   timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_tareas TO authenticated;
GRANT ALL ON public.expediente_tareas TO service_role;
ALTER TABLE public.expediente_tareas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tareas_expediente ON public.expediente_tareas(expediente_id);
CREATE INDEX idx_tareas_responsable_activas
  ON public.expediente_tareas(responsable_id)
  WHERE estado IN ('pendiente','en_progreso');
CREATE TRIGGER tg_tareas_updated BEFORE UPDATE ON public.expediente_tareas
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 3) expediente_bitacora (append-only para usuarios)
CREATE TABLE public.expediente_bitacora (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comentario    text NOT NULL,
  tipo          public.bitacora_tipo NOT NULL DEFAULT 'comentario',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.expediente_bitacora TO authenticated;
GRANT ALL ON public.expediente_bitacora TO service_role;
ALTER TABLE public.expediente_bitacora ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bitacora_expediente_created
  ON public.expediente_bitacora(expediente_id, created_at DESC);

-- 4) Helper RLS reutilizable
CREATE OR REPLACE FUNCTION public.can_access_expediente(_uid uuid, _exp uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_uid,'super_admin'::app_role)
      OR has_role(_uid,'admin'::app_role)
      OR has_role(_uid,'gerencia'::app_role)
      OR has_role(_uid,'director_financiero_qa'::app_role)
      OR has_role(_uid,'director_juridico'::app_role)
      OR has_role(_uid,'operaciones'::app_role)
      OR has_role(_uid,'juridica'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.expedientes e
        WHERE e.id = _exp AND e.asesor_id = _uid
      );
$$;

-- 5) RLS Policies
CREATE POLICY tareas_read ON public.expediente_tareas FOR SELECT TO authenticated
  USING (
    public.can_access_expediente(auth.uid(), expediente_id)
    OR responsable_id = auth.uid()
  );
CREATE POLICY tareas_write ON public.expediente_tareas FOR ALL TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

CREATE POLICY bitacora_read ON public.expediente_bitacora FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY bitacora_insert ON public.expediente_bitacora FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_expediente(auth.uid(), expediente_id)
    AND usuario_id = auth.uid()
  );

-- 6) Backfill idempotente Cliente Maestro a partir de expedientes
INSERT INTO public.clientes (cedula, nombre_completo, fecha_primer_caso, fecha_ultimo_caso)
SELECT DISTINCT ON (e.cedula)
       e.cedula,
       COALESCE(NULLIF(e.cliente_nombre,''), 'Sin nombre'),
       MIN(e.created_at) OVER (PARTITION BY e.cedula),
       MAX(e.updated_at) OVER (PARTITION BY e.cedula)
  FROM public.expedientes e
 WHERE e.cliente_id IS NULL
   AND e.cedula IS NOT NULL
   AND btrim(e.cedula) <> ''
ON CONFLICT (cedula) DO NOTHING;

UPDATE public.expedientes e
   SET cliente_id = c.id
  FROM public.clientes c
 WHERE e.cliente_id IS NULL
   AND e.cedula IS NOT NULL
   AND btrim(e.cedula) <> ''
   AND e.cedula = c.cedula;