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
  v_asesor uuid;
BEGIN
  IF NEW.expediente_id IS NOT NULL THEN
    SELECT e.asesor_id INTO v_asesor FROM public.expedientes e WHERE e.id = NEW.expediente_id;
    IF v_asesor IS NOT NULL THEN
      NEW.analista_id := v_asesor;
    END IF;
  END IF;

  IF NEW.codigo IS NOT NULL THEN RETURN NEW; END IF;
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;
  v_ini := public.nuvia_iniciales_perfil(NEW.analista_id);
  PERFORM pg_advisory_xact_lock(
    hashtext('nuv_aud_' || v_year::text || '_' || v_ini)
  );
  SELECT COALESCE(MAX(CAST(split_part(codigo,'_',5) AS int)),0) + 1
    INTO v_next
    FROM public.qa_auditorias
   WHERE codigo LIKE 'NUV_AUD_' || v_year || '_' || v_ini || '_%';
  NEW.codigo := 'NUV_AUD_' || v_year || '_' || v_ini || '_' || lpad(v_next::text,5,'0');
  RETURN NEW;
END;
$$;

UPDATE public.qa_auditorias q
   SET analista_id = e.asesor_id
  FROM public.expedientes e
 WHERE q.expediente_id = e.id
   AND e.asesor_id IS NOT NULL
   AND (q.analista_id IS DISTINCT FROM e.asesor_id);

WITH afectadas AS (
  SELECT DISTINCT
    EXTRACT(YEAR FROM q.created_at)::int AS yr,
    public.nuvia_iniciales_perfil(q.analista_id) AS ini
  FROM public.qa_auditorias q
  JOIN public.expedientes e ON e.id = q.expediente_id
  WHERE e.asesor_id IS NOT NULL
    AND q.analista_id = e.asesor_id
)
UPDATE public.qa_auditorias q
   SET codigo = NULL
  FROM afectadas a
 WHERE EXTRACT(YEAR FROM q.created_at)::int = a.yr
   AND public.nuvia_iniciales_perfil(q.analista_id) = a.ini;

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