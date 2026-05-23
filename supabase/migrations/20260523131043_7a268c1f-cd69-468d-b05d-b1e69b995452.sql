
ALTER TABLE public.apoderados_nuvex
  ADD COLUMN IF NOT EXISTS predeterminado_general boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS predeterminado_fna boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bancos_asignados text[] NOT NULL DEFAULT '{}'::text[];

-- Solo un apoderado puede ser predeterminado general
CREATE UNIQUE INDEX IF NOT EXISTS apoderados_unico_predeterminado_general
  ON public.apoderados_nuvex ((true)) WHERE predeterminado_general = true;

-- Solo un apoderado puede ser predeterminado FNA
CREATE UNIQUE INDEX IF NOT EXISTS apoderados_unico_predeterminado_fna
  ON public.apoderados_nuvex ((true)) WHERE predeterminado_fna = true;
