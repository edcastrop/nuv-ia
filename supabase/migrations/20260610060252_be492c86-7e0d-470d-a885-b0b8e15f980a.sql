CREATE TABLE public.expediente_entrega_documental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  banco text NOT NULL,
  modalidad text NOT NULL CHECK (modalidad IN ('correo','fisica','ninguna')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','programada','enviada_correo','entregada_fisica','no_aplica')),
  fecha_programada timestamptz,
  fecha_completada timestamptz,
  notas text,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expediente_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_entrega_documental TO authenticated;
GRANT ALL ON public.expediente_entrega_documental TO service_role;

ALTER TABLE public.expediente_entrega_documental ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso entrega documental segun expediente"
  ON public.expediente_entrega_documental
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_entrega_documental.expediente_id
        AND (e.asesor_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'gerencia')
          OR public.has_role(auth.uid(), 'operaciones'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expedientes e
      WHERE e.id = expediente_entrega_documental.expediente_id
        AND (e.asesor_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'gerencia')
          OR public.has_role(auth.uid(), 'operaciones'))
    )
  );

CREATE INDEX idx_entrega_doc_expediente ON public.expediente_entrega_documental(expediente_id);
CREATE INDEX idx_entrega_doc_estado ON public.expediente_entrega_documental(estado);
CREATE INDEX idx_entrega_doc_fecha_prog ON public.expediente_entrega_documental(fecha_programada) WHERE fecha_programada IS NOT NULL;

CREATE TRIGGER trg_entrega_doc_updated_at
  BEFORE UPDATE ON public.expediente_entrega_documental
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
