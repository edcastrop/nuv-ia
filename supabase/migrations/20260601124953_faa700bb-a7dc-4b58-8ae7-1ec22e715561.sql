-- Enums
DO $$ BEGIN
  CREATE TYPE public.incidente_tipo AS ENUM ('documental','juridico','financiero','banco','cliente','sistema','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incidente_severidad AS ENUM ('baja','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incidente_estado AS ENUM ('abierto','en_gestion','resuelto','cerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.incidentes_operativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NULL,
  titulo text NOT NULL,
  descripcion text NULL,
  tipo public.incidente_tipo NOT NULL DEFAULT 'otro',
  severidad public.incidente_severidad NOT NULL DEFAULT 'media',
  estado public.incidente_estado NOT NULL DEFAULT 'abierto',
  reportado_por uuid NOT NULL,
  asignado_a uuid NULL,
  resolucion text NULL,
  resuelto_at timestamptz NULL,
  cerrado_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidentes_operativos TO authenticated;
GRANT ALL ON public.incidentes_operativos TO service_role;

ALTER TABLE public.incidentes_operativos ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin/gerencia ven todo; resto ve los suyos (reportados o asignados)
CREATE POLICY "Incidentes select"
ON public.incidentes_operativos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR reportado_por = auth.uid()
  OR asignado_a = auth.uid()
);

-- INSERT: cualquier autenticado puede reportar (debe ser él mismo el reportado_por)
CREATE POLICY "Incidentes insert"
ON public.incidentes_operativos
FOR INSERT TO authenticated
WITH CHECK (reportado_por = auth.uid());

-- UPDATE: super_admin/gerencia gestionan; el asignado puede actualizar su incidente
CREATE POLICY "Incidentes update"
ON public.incidentes_operativos
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'gerencia'::app_role)
  OR asignado_a = auth.uid()
);

-- DELETE: solo super_admin
CREATE POLICY "Incidentes delete"
ON public.incidentes_operativos
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_incidentes_updated_at
BEFORE UPDATE ON public.incidentes_operativos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices útiles
CREATE INDEX idx_incidentes_estado ON public.incidentes_operativos(estado);
CREATE INDEX idx_incidentes_expediente ON public.incidentes_operativos(expediente_id);
CREATE INDEX idx_incidentes_asignado ON public.incidentes_operativos(asignado_a);
CREATE INDEX idx_incidentes_reportado ON public.incidentes_operativos(reportado_por);
CREATE INDEX idx_incidentes_created ON public.incidentes_operativos(created_at DESC);