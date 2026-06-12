
-- 1. Columnas de cierre de alertas
ALTER TABLE public.qa_alertas
  ADD COLUMN IF NOT EXISTS resuelta_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resuelta_at timestamptz,
  ADD COLUMN IF NOT EXISTS notas text;

-- 2. Tabla historial de reglas
CREATE TABLE IF NOT EXISTS public.qa_reglas_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regla_id uuid NOT NULL REFERENCES public.qa_reglas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  version_anterior integer NOT NULL,
  version_nueva integer NOT NULL,
  payload_anterior jsonb,
  payload_nuevo jsonb,
  activa_anterior boolean,
  activa_nueva boolean,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.qa_reglas_historial TO authenticated;
GRANT ALL ON public.qa_reglas_historial TO service_role;

ALTER TABLE public.qa_reglas_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_reglas_historial_select ON public.qa_reglas_historial;
CREATE POLICY qa_reglas_historial_select ON public.qa_reglas_historial
  FOR SELECT USING (public.can_use_qa_ai(auth.uid()));

DROP POLICY IF EXISTS qa_reglas_historial_insert ON public.qa_reglas_historial;
CREATE POLICY qa_reglas_historial_insert ON public.qa_reglas_historial
  FOR INSERT WITH CHECK (public.can_use_qa_ai(auth.uid()));

CREATE INDEX IF NOT EXISTS qa_reglas_historial_regla_id_idx
  ON public.qa_reglas_historial (regla_id, changed_at DESC);

-- 3. Trigger de versionado + historial
CREATE OR REPLACE FUNCTION public.qa_reglas_versionar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean;
BEGIN
  v_changed := (OLD.payload IS DISTINCT FROM NEW.payload)
            OR (OLD.activa  IS DISTINCT FROM NEW.activa);
  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  NEW.version    := COALESCE(OLD.version, 1) + 1;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();

  INSERT INTO public.qa_reglas_historial
    (regla_id, codigo, version_anterior, version_nueva,
     payload_anterior, payload_nuevo, activa_anterior, activa_nueva, changed_by)
  VALUES
    (OLD.id, OLD.codigo, OLD.version, NEW.version,
     OLD.payload, NEW.payload, OLD.activa, NEW.activa, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_reglas_versionar_trg ON public.qa_reglas;
CREATE TRIGGER qa_reglas_versionar_trg
BEFORE UPDATE ON public.qa_reglas
FOR EACH ROW EXECUTE FUNCTION public.qa_reglas_versionar();
