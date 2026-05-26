-- Audiencias en KB
ALTER TABLE public.nuvex_kb
  ADD COLUMN IF NOT EXISTS audiencias text[] NOT NULL DEFAULT ARRAY['interno']::text[];

ALTER TABLE public.nuvex_kb
  DROP CONSTRAINT IF EXISTS nuvex_kb_audiencias_chk;

ALTER TABLE public.nuvex_kb
  ADD CONSTRAINT nuvex_kb_audiencias_chk
  CHECK (audiencias <@ ARRAY['interno','apoderado','cliente','publico']::text[] AND array_length(audiencias,1) >= 1);

CREATE INDEX IF NOT EXISTS idx_nuvex_kb_audiencias ON public.nuvex_kb USING gin (audiencias);

-- Auditoría: registrar la audiencia resuelta
ALTER TABLE public.nuvex_ia_log
  ADD COLUMN IF NOT EXISTS audiencia text;