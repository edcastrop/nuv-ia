
CREATE TABLE public.expediente_proyecciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  auditoria_id UUID NULL,
  archivo_nombre TEXT NOT NULL,
  archivo_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NULL,
  origen_zip TEXT NULL,
  password_usada BOOLEAN NOT NULL DEFAULT false,
  datos JSONB NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  error TEXT NULL,
  parsed_at TIMESTAMPTZ NULL,
  uploaded_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exp_proyecciones_expediente ON public.expediente_proyecciones(expediente_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_proyecciones TO authenticated;
GRANT ALL ON public.expediente_proyecciones TO service_role;

ALTER TABLE public.expediente_proyecciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read proyecciones"
  ON public.expediente_proyecciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert proyecciones"
  ON public.expediente_proyecciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update proyecciones"
  ON public.expediente_proyecciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete proyecciones"
  ON public.expediente_proyecciones FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_expediente_proyecciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER tg_touch_expediente_proyecciones
BEFORE UPDATE ON public.expediente_proyecciones
FOR EACH ROW EXECUTE FUNCTION public.touch_expediente_proyecciones_updated_at();

-- Storage policies for the proyecciones-banco bucket (bucket is created via tool)
CREATE POLICY "auth read proyecciones bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proyecciones-banco');
CREATE POLICY "auth insert proyecciones bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proyecciones-banco');
CREATE POLICY "auth update proyecciones bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proyecciones-banco') WITH CHECK (bucket_id = 'proyecciones-banco');
CREATE POLICY "auth delete proyecciones bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proyecciones-banco');
