
-- Tipos
DO $$ BEGIN
  CREATE TYPE colab_canal_tipo AS ENUM ('area','caso','dm','custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Canales
CREATE TABLE public.colab_canales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo colab_canal_tipo NOT NULL DEFAULT 'custom',
  area text,
  caso_id uuid,
  privado boolean NOT NULL DEFAULT false,
  archivado boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX colab_canales_caso_uk ON public.colab_canales(caso_id) WHERE caso_id IS NOT NULL;
CREATE INDEX colab_canales_tipo_idx ON public.colab_canales(tipo);

-- Miembros
CREATE TABLE public.colab_miembros (
  canal_id uuid NOT NULL REFERENCES public.colab_canales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'miembro',
  ultima_lectura timestamptz NOT NULL DEFAULT now(),
  silenciado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, user_id)
);
CREATE INDEX colab_miembros_user_idx ON public.colab_miembros(user_id);

-- Mensajes
CREATE TABLE public.colab_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.colab_canales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  texto text,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  menciones uuid[] NOT NULL DEFAULT '{}',
  reply_to uuid,
  editado_at timestamptz,
  borrado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX colab_mensajes_canal_idx ON public.colab_mensajes(canal_id, created_at DESC);

-- Notificaciones
CREATE TABLE public.colab_notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  canal_id uuid REFERENCES public.colab_canales(id) ON DELETE CASCADE,
  mensaje_id uuid REFERENCES public.colab_mensajes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX colab_notif_user_idx ON public.colab_notificaciones(user_id, leida, created_at DESC);

-- Auditoría
CREATE TABLE public.colab_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  canal_id uuid,
  accion text NOT NULL,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper: es miembro
CREATE OR REPLACE FUNCTION public.colab_es_miembro(_canal uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.colab_miembros WHERE canal_id = _canal AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.colab_puede_ver_canal(_canal uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.colab_canales c
    WHERE c.id = _canal
      AND (
        NOT c.privado
        OR c.created_by = _user
        OR public.colab_es_miembro(_canal, _user)
        OR public.has_role(_user, 'super_admin'::app_role)
      )
  );
$$;

-- RLS
ALTER TABLE public.colab_canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colab_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colab_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colab_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colab_auditoria ENABLE ROW LEVEL SECURITY;

-- Canales
CREATE POLICY "canales select" ON public.colab_canales FOR SELECT TO authenticated
  USING (NOT privado OR created_by = auth.uid() OR colab_es_miembro(id, auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "canales insert" ON public.colab_canales FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "canales update" ON public.colab_canales FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "canales delete" ON public.colab_canales FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));

-- Miembros
CREATE POLICY "miembros select" ON public.colab_miembros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR colab_puede_ver_canal(canal_id, auth.uid()));
CREATE POLICY "miembros insert" ON public.colab_miembros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.colab_canales c WHERE c.id = canal_id AND c.created_by = auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role)
  );
CREATE POLICY "miembros update" ON public.colab_miembros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "miembros delete" ON public.colab_miembros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.colab_canales c WHERE c.id = canal_id AND c.created_by = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));

-- Mensajes
CREATE POLICY "mensajes select" ON public.colab_mensajes FOR SELECT TO authenticated
  USING (colab_puede_ver_canal(canal_id, auth.uid()));
CREATE POLICY "mensajes insert" ON public.colab_mensajes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND colab_puede_ver_canal(canal_id, auth.uid()));
CREATE POLICY "mensajes update" ON public.colab_mensajes FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "mensajes delete" ON public.colab_mensajes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));

-- Notificaciones
CREATE POLICY "notif select" ON public.colab_notificaciones FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif insert" ON public.colab_notificaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif update" ON public.colab_notificaciones FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif delete" ON public.colab_notificaciones FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Auditoría
CREATE POLICY "audit select" ON public.colab_auditoria FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "audit insert" ON public.colab_auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: notificar menciones + miembros del canal
CREATE OR REPLACE FUNCTION public.colab_after_mensaje()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  -- notificar menciones
  IF NEW.menciones IS NOT NULL THEN
    FOREACH m IN ARRAY NEW.menciones LOOP
      IF m <> NEW.user_id THEN
        INSERT INTO public.colab_notificaciones(user_id, canal_id, mensaje_id, tipo)
        VALUES (m, NEW.canal_id, NEW.id, 'mencion');
      END IF;
    END LOOP;
  END IF;
  -- notificar miembros (no autor, no ya mencionados)
  INSERT INTO public.colab_notificaciones(user_id, canal_id, mensaje_id, tipo)
  SELECT mb.user_id, NEW.canal_id, NEW.id, 'mensaje'
  FROM public.colab_miembros mb
  WHERE mb.canal_id = NEW.canal_id
    AND mb.user_id <> NEW.user_id
    AND NOT mb.silenciado
    AND NOT (mb.user_id = ANY(COALESCE(NEW.menciones,'{}'::uuid[])));
  RETURN NEW;
END $$;

CREATE TRIGGER colab_mensaje_notif AFTER INSERT ON public.colab_mensajes
FOR EACH ROW EXECUTE FUNCTION public.colab_after_mensaje();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.colab_mensajes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colab_notificaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colab_canales;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('colab-adjuntos','colab-adjuntos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "colab adjuntos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'colab-adjuntos');
CREATE POLICY "colab adjuntos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'colab-adjuntos' AND owner = auth.uid());
CREATE POLICY "colab adjuntos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'colab-adjuntos' AND (owner = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role)));

-- Seed canales por área
INSERT INTO public.colab_canales(nombre, descripcion, tipo, area, privado, created_by)
SELECT n, d, 'area'::colab_canal_tipo, a, false, NULL
FROM (VALUES
  ('# general','Canal general NUVEX','general'),
  ('# juridica','Área Jurídica','juridica'),
  ('# operaciones','Operaciones','operaciones'),
  ('# contabilidad','Contabilidad','contabilidad'),
  ('# comercial','Comercial / Licenciados','comercial'),
  ('# qa','Director Financiero QA','qa'),
  ('# gerencia','Gerencia','gerencia')
) AS t(n,d,a);
