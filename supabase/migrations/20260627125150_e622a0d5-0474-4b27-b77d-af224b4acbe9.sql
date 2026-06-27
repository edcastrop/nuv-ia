
-- 1. Columnas nuevas
ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS auditor_aprobado_at timestamptz,
  ADD COLUMN IF NOT EXISTS auditor_aprobado_by uuid,
  ADD COLUMN IF NOT EXISTS auditor_notas text;

CREATE UNIQUE INDEX IF NOT EXISTS qa_auditorias_codigo_uk
  ON public.qa_auditorias(codigo) WHERE codigo IS NOT NULL;

-- 2. Iniciales del analista (a partir de profiles.nombre o email)
CREATE OR REPLACE FUNCTION public.nuvia_iniciales_perfil(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_parts text[];
  v_ini text;
BEGIN
  IF _user_id IS NULL THEN RETURN 'XX'; END IF;
  SELECT COALESCE(NULLIF(trim(p.nombre), ''), split_part(p.email,'@',1))
  INTO v_nombre
  FROM public.profiles p WHERE p.id = _user_id;
  IF v_nombre IS NULL OR length(v_nombre) = 0 THEN RETURN 'XX'; END IF;
  v_parts := regexp_split_to_array(trim(v_nombre), '\s+');
  IF array_length(v_parts,1) >= 2 THEN
    v_ini := upper(left(v_parts[1],1)) || upper(left(v_parts[2],1));
  ELSE
    v_ini := upper(left(v_parts[1],1)) || upper(COALESCE(NULLIF(substr(v_parts[1],2,1),''),'X'));
  END IF;
  RETURN COALESCE(NULLIF(v_ini,''), 'XX');
END;
$$;

-- 3. Trigger para generar código en cada INSERT
CREATE OR REPLACE FUNCTION public.nuvia_generate_audit_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_ini text;
  v_next int;
BEGIN
  IF NEW.codigo IS NOT NULL THEN RETURN NEW; END IF;
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;
  v_ini := public.nuvia_iniciales_perfil(NEW.analista_id);
  PERFORM pg_advisory_xact_lock(
    hashtext('nuv_aud_' || v_year::text || '_' || COALESCE(NEW.analista_id::text,'null'))
  );
  SELECT COALESCE(MAX(CAST(split_part(codigo,'_',5) AS int)),0) + 1
    INTO v_next
    FROM public.qa_auditorias
   WHERE codigo LIKE 'NUV_AUD_' || v_year || '_' || v_ini || '_%';
  NEW.codigo := 'NUV_AUD_' || v_year || '_' || v_ini || '_' || lpad(v_next::text,5,'0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_auditorias_codigo ON public.qa_auditorias;
CREATE TRIGGER trg_qa_auditorias_codigo
BEFORE INSERT ON public.qa_auditorias
FOR EACH ROW EXECUTE FUNCTION public.nuvia_generate_audit_codigo();

-- 4. Backfill cronológico
WITH ordered AS (
  SELECT
    id,
    EXTRACT(YEAR FROM created_at)::int AS yr,
    public.nuvia_iniciales_perfil(analista_id) AS ini,
    row_number() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at)::int, public.nuvia_iniciales_perfil(analista_id)
      ORDER BY created_at, id
    ) AS rn
  FROM public.qa_auditorias
  WHERE codigo IS NULL
)
UPDATE public.qa_auditorias q
   SET codigo = 'NUV_AUD_' || o.yr || '_' || o.ini || '_' || lpad(o.rn::text,5,'0')
  FROM ordered o
 WHERE o.id = q.id;
