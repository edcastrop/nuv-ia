-- Código institucional del expediente: NVX_YYYY_NNNN (sequencial por año).
ALTER TABLE public.expedientes ADD COLUMN IF NOT EXISTS codigo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expedientes_codigo ON public.expedientes(codigo) WHERE codigo IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.expedientes_codigo_seq START 1;

CREATE OR REPLACE FUNCTION public.set_expediente_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    v_year := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
    -- Contar expedientes existentes en el mismo año + 1 (sequencial por año)
    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^NVX_' || v_year || '_[0-9]+$')
           THEN (regexp_replace(codigo, '^NVX_[0-9]+_', ''))::bigint
           ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.expedientes;
    NEW.codigo := 'NVX_' || v_year || '_' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_expediente_codigo ON public.expedientes;
CREATE TRIGGER trg_set_expediente_codigo
  BEFORE INSERT ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expediente_codigo();

-- Backfill existentes en orden cronológico.
DO $$
DECLARE
  r RECORD;
  v_year TEXT;
  v_seq_year TEXT := '';
  v_n INTEGER := 0;
BEGIN
  FOR r IN SELECT id, created_at FROM public.expedientes WHERE codigo IS NULL ORDER BY created_at ASC LOOP
    v_year := to_char(r.created_at, 'YYYY');
    IF v_year <> v_seq_year THEN
      v_seq_year := v_year;
      SELECT COALESCE(MAX(
        CASE WHEN codigo ~ ('^NVX_' || v_year || '_[0-9]+$')
             THEN (regexp_replace(codigo, '^NVX_[0-9]+_', ''))::bigint
             ELSE 0 END
      ), 0)::int INTO v_n
      FROM public.expedientes;
    END IF;
    v_n := v_n + 1;
    UPDATE public.expedientes
       SET codigo = 'NVX_' || v_year || '_' || lpad(v_n::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;