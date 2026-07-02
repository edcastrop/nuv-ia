
CREATE OR REPLACE FUNCTION public.set_expediente_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_ini  TEXT;
  v_seq  BIGINT;
  v_owner UUID;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' OR NEW.codigo ~ '^NVX_' THEN
    v_year := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
    v_owner := COALESCE(NEW.licenciado_id, NEW.asesor_id);
    v_ini := public.nuvia_iniciales_perfil(v_owner);
    PERFORM pg_advisory_xact_lock(hashtext('nuv_exp_' || v_year || '_' || v_ini));
    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^NUV_' || v_year || '_' || v_ini || '_[0-9]+$')
           THEN (regexp_replace(codigo, '^NUV_[0-9]+_[^_]+_', ''))::bigint
           ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.expedientes;
    NEW.codigo := 'NUV_' || v_year || '_' || v_ini || '_' || lpad(v_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: reemplaza códigos NVX_ y nulos por el nuevo formato manteniendo orden cronológico
DO $$
DECLARE
  r RECORD;
  v_year TEXT;
  v_ini  TEXT;
  v_owner UUID;
  v_seq BIGINT;
BEGIN
  FOR r IN
    SELECT id, created_at, licenciado_id, asesor_id
      FROM public.expedientes
     WHERE codigo IS NULL OR codigo = '' OR codigo ~ '^NVX_'
     ORDER BY created_at ASC
  LOOP
    v_year := to_char(COALESCE(r.created_at, now()), 'YYYY');
    v_owner := COALESCE(r.licenciado_id, r.asesor_id);
    v_ini := public.nuvia_iniciales_perfil(v_owner);
    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^NUV_' || v_year || '_' || v_ini || '_[0-9]+$')
           THEN (regexp_replace(codigo, '^NUV_[0-9]+_[^_]+_', ''))::bigint
           ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.expedientes;
    UPDATE public.expedientes
       SET codigo = 'NUV_' || v_year || '_' || v_ini || '_' || lpad(v_seq::text, 6, '0')
     WHERE id = r.id;
  END LOOP;
END $$;
