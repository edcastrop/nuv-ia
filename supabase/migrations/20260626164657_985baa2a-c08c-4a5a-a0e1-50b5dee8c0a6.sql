
ALTER TYPE colab_canal_tipo ADD VALUE IF NOT EXISTS 'qa_auditoria';

ALTER TABLE public.colab_canales ADD COLUMN IF NOT EXISTS auditoria_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS colab_canales_auditoria_uk
  ON public.colab_canales(auditoria_id) WHERE auditoria_id IS NOT NULL;
