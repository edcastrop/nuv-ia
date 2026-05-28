
-- Validación de Identidad y Control Contractual
-- Añade columnas de validación al expediente, historial y versionamiento documental.

ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS validacion_estado text NOT NULL DEFAULT 'pendiente_validacion',
  ADD COLUMN IF NOT EXISTS validacion_confirmado_licenciado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validacion_confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS validacion_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS validacion_aprobado_por uuid,
  ADD COLUMN IF NOT EXISTS validacion_aprobado_at timestamptz,
  ADD COLUMN IF NOT EXISTS validacion_motivo_devolucion text,
  ADD COLUMN IF NOT EXISTS validacion_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.expedientes
  DROP CONSTRAINT IF EXISTS expedientes_validacion_estado_check;
ALTER TABLE public.expedientes
  ADD CONSTRAINT expedientes_validacion_estado_check
  CHECK (validacion_estado IN (
    'pendiente_validacion',
    'en_revision_contratacion',
    'devuelto_datos_incorrectos',
    'datos_validados',
    'bloqueado_inconsistencia'
  ));

CREATE INDEX IF NOT EXISTS idx_expedientes_validacion_estado ON public.expedientes(validacion_estado);

-- Historial de validación
CREATE TABLE IF NOT EXISTS public.expediente_validacion_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  accion text NOT NULL,
  motivo text,
  datos_snapshot jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.expediente_validacion_historial TO authenticated;
GRANT ALL ON public.expediente_validacion_historial TO service_role;

ALTER TABLE public.expediente_validacion_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Validacion hist insert"
  ON public.expediente_validacion_historial FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Validacion hist select por owner/manager/contratacion"
  ON public.expediente_validacion_historial FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_validacion_historial.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerencia'::app_role)
          OR has_role(auth.uid(), 'juridica'::app_role)
          OR has_role(auth.uid(), 'director_juridico'::app_role)
          OR has_role(auth.uid(), 'operaciones'::app_role)
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_validacion_hist_exp ON public.expediente_validacion_historial(expediente_id, created_at DESC);

-- Versionamiento documental
CREATE TABLE IF NOT EXISTS public.documentos_juridicos_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL,
  tipo text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  obsoleto boolean NOT NULL DEFAULT false,
  motivo_obsoleto text,
  snapshot jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  obsoleto_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.documentos_juridicos_versiones TO authenticated;
GRANT ALL ON public.documentos_juridicos_versiones TO service_role;

ALTER TABLE public.documentos_juridicos_versiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs versiones insert"
  ON public.documentos_juridicos_versiones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Docs versiones select"
  ON public.documentos_juridicos_versiones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = documentos_juridicos_versiones.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerencia'::app_role)
          OR has_role(auth.uid(), 'juridica'::app_role)
          OR has_role(auth.uid(), 'director_juridico'::app_role)
          OR has_role(auth.uid(), 'operaciones'::app_role)
        )
    )
  );

CREATE POLICY "Docs versiones update obsoleto"
  ON public.documentos_juridicos_versiones FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_docs_vers_exp ON public.documentos_juridicos_versiones(expediente_id, tipo, version DESC);

-- Función helper: ¿el usuario es contratación/jurídica/admin?
CREATE OR REPLACE FUNCTION public.can_validar_identidad(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_uid, 'super_admin'::app_role)
      OR has_role(_uid, 'admin'::app_role)
      OR has_role(_uid, 'gerencia'::app_role)
      OR has_role(_uid, 'juridica'::app_role)
      OR has_role(_uid, 'director_juridico'::app_role)
      OR has_role(_uid, 'operaciones'::app_role);
$$;

-- Trigger: si tras datos_validados cambian campos críticos, vuelve a pendiente
CREATE OR REPLACE FUNCTION public.trg_expediente_cambio_critico()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambio boolean := false;
  v_old_nombre text;
  v_new_nombre text;
BEGIN
  IF OLD.validacion_estado <> 'datos_validados' THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_nombre IS DISTINCT FROM OLD.cliente_nombre
     OR NEW.cedula IS DISTINCT FROM OLD.cedula
     OR NEW.banco IS DISTINCT FROM OLD.banco
     OR NEW.numero_credito IS DISTINCT FROM OLD.numero_credito
     OR NEW.producto IS DISTINCT FROM OLD.producto THEN
    v_cambio := true;
  END IF;

  -- También chequear cliente_data jsonb (informacionJuridica, ciudad, dirección, etc.)
  IF NOT v_cambio AND NEW.cliente_data IS DISTINCT FROM OLD.cliente_data THEN
    v_cambio := COALESCE(
      (NEW.cliente_data->>'nombre') IS DISTINCT FROM (OLD.cliente_data->>'nombre')
      OR (NEW.cliente_data->>'cedula') IS DISTINCT FROM (OLD.cliente_data->>'cedula')
      OR (NEW.cliente_data->>'banco') IS DISTINCT FROM (OLD.cliente_data->>'banco')
      OR (NEW.cliente_data->>'numeroCredito') IS DISTINCT FROM (OLD.cliente_data->>'numeroCredito')
      OR (NEW.cliente_data->>'tipoProducto') IS DISTINCT FROM (OLD.cliente_data->>'tipoProducto')
      OR (NEW.cliente_data->'informacionJuridica') IS DISTINCT FROM (OLD.cliente_data->'informacionJuridica'),
      false
    );
  END IF;

  IF v_cambio THEN
    NEW.validacion_estado := 'pendiente_validacion';
    NEW.validacion_confirmado_licenciado := false;
    NEW.validacion_confirmado_at := NULL;
    NEW.validacion_version := COALESCE(OLD.validacion_version, 1) + 1;

    INSERT INTO public.expediente_validacion_historial(expediente_id, accion, motivo, user_id, datos_snapshot)
    VALUES (NEW.id, 'cambio_critico',
      'Cambio en datos críticos tras aprobación. Documentos marcados como obsoletos.',
      auth.uid(),
      jsonb_build_object(
        'antes', jsonb_build_object('nombre', OLD.cliente_nombre, 'cedula', OLD.cedula, 'banco', OLD.banco, 'numero_credito', OLD.numero_credito),
        'despues', jsonb_build_object('nombre', NEW.cliente_nombre, 'cedula', NEW.cedula, 'banco', NEW.banco, 'numero_credito', NEW.numero_credito)
      )
    );

    UPDATE public.documentos_juridicos_versiones
      SET obsoleto = true,
          motivo_obsoleto = COALESCE(motivo_obsoleto, 'Cambio en dato crítico tras validación'),
          obsoleto_at = COALESCE(obsoleto_at, now())
    WHERE expediente_id = NEW.id AND NOT obsoleto;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expediente_cambio_critico ON public.expedientes;
CREATE TRIGGER trg_expediente_cambio_critico
  BEFORE UPDATE ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_expediente_cambio_critico();
