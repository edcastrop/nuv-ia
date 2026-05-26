
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.academia_rol AS ENUM (
    'licenciado','operaciones','juridica','contabilidad',
    'director_financiero_qa','gerencia','super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leccion_tipo AS ENUM ('texto','pdf','video','imagen','checklist','enlace','faq');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pregunta_tipo AS ENUM ('unica','multiple','verdadero_falso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ayuda_tipo AS ENUM ('guia','video','faq','checklist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.academia_rol_del_usuario(_uid uuid)
RETURNS academia_rol LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_uid,'super_admin'::app_role) THEN 'super_admin'::academia_rol
    WHEN public.has_role(_uid,'admin'::app_role) THEN 'super_admin'::academia_rol
    WHEN public.has_role(_uid,'gerencia'::app_role) THEN 'gerencia'::academia_rol
    WHEN public.has_role(_uid,'director_financiero_qa'::app_role) THEN 'director_financiero_qa'::academia_rol
    WHEN public.has_role(_uid,'contabilidad'::app_role) THEN 'contabilidad'::academia_rol
    WHEN public.has_role(_uid,'juridica'::app_role) THEN 'juridica'::academia_rol
    WHEN public.has_role(_uid,'director_juridico'::app_role) THEN 'juridica'::academia_rol
    WHEN public.has_role(_uid,'operaciones'::app_role) THEN 'operaciones'::academia_rol
    WHEN public.has_role(_uid,'auxiliar_operativo'::app_role) THEN 'operaciones'::academia_rol
    WHEN public.has_role(_uid,'cartera'::app_role) THEN 'contabilidad'::academia_rol
    WHEN public.has_role(_uid,'licenciado'::app_role) THEN 'licenciado'::academia_rol
    WHEN public.has_role(_uid,'asesor'::app_role) THEN 'licenciado'::academia_rol
    ELSE 'licenciado'::academia_rol
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role) OR public.has_role(_uid,'admin'::app_role);
$$;

-- TABLES
CREATE TABLE IF NOT EXISTS public.academia_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_destino academia_rol NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  orden int NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.academia_cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  orden int NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.academia_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo leccion_tipo NOT NULL DEFAULT 'texto',
  contenido jsonb NOT NULL DEFAULT '{}'::jsonb,
  orden int NOT NULL DEFAULT 0,
  duracion_min int NOT NULL DEFAULT 5,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid REFERENCES public.academia_modulos(id) ON DELETE CASCADE,
  leccion_id uuid REFERENCES public.academia_lecciones(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'enlace',
  url text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.academia_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  nota_minima numeric(5,2) NOT NULL DEFAULT 80,
  intentos_permitidos int NOT NULL DEFAULT 3,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id uuid NOT NULL REFERENCES public.academia_evaluaciones(id) ON DELETE CASCADE,
  enunciado text NOT NULL,
  tipo pregunta_tipo NOT NULL DEFAULT 'unica',
  opciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  respuesta_correcta jsonb NOT NULL DEFAULT '[]'::jsonb,
  puntos numeric(5,2) NOT NULL DEFAULT 1,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id uuid NOT NULL REFERENCES public.academia_evaluaciones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  nota numeric(5,2) NOT NULL DEFAULT 0,
  porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  aprobado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academia_progreso_lecciones (
  user_id uuid NOT NULL,
  leccion_id uuid NOT NULL REFERENCES public.academia_lecciones(id) ON DELETE CASCADE,
  completada boolean NOT NULL DEFAULT true,
  completada_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, leccion_id)
);

CREATE TABLE IF NOT EXISTS public.academia_certificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  curso_id uuid NOT NULL REFERENCES public.academia_cursos(id) ON DELETE CASCADE,
  nota_final numeric(5,2) NOT NULL DEFAULT 0,
  codigo text NOT NULL UNIQUE,
  emitida_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curso_id)
);

CREATE TABLE IF NOT EXISTS public.modulo_ayuda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_sistema text NOT NULL,
  tipo ayuda_tipo NOT NULL,
  titulo text NOT NULL,
  contenido jsonb NOT NULL DEFAULT '{}'::jsonb,
  orden int NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers updated_at
CREATE TRIGGER trg_acad_cursos_upd BEFORE UPDATE ON public.academia_cursos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acad_modulos_upd BEFORE UPDATE ON public.academia_modulos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acad_lecciones_upd BEFORE UPDATE ON public.academia_lecciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acad_evals_upd BEFORE UPDATE ON public.academia_evaluaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_modulo_ayuda_upd BEFORE UPDATE ON public.modulo_ayuda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENABLE RLS
ALTER TABLE public.academia_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_intentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_progreso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_certificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulo_ayuda ENABLE ROW LEVEL SECURITY;

-- POLICIES: cursos
CREATE POLICY "Cursos select por rol o manager" ON public.academia_cursos FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(),'gerencia'::app_role)
    OR (activo = true AND rol_destino = public.academia_rol_del_usuario(auth.uid()))
  );
CREATE POLICY "Cursos manage super_admin" ON public.academia_cursos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: modulos
CREATE POLICY "Modulos select" ON public.academia_modulos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academia_cursos c WHERE c.id = curso_id AND (
    public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'gerencia'::app_role)
    OR (c.activo AND c.rol_destino = public.academia_rol_del_usuario(auth.uid()))
  )));
CREATE POLICY "Modulos manage super_admin" ON public.academia_modulos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: lecciones
CREATE POLICY "Lecciones select" ON public.academia_lecciones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.academia_modulos m JOIN public.academia_cursos c ON c.id = m.curso_id
    WHERE m.id = modulo_id AND (
      public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'gerencia'::app_role)
      OR (c.activo AND c.rol_destino = public.academia_rol_del_usuario(auth.uid()))
    )
  ));
CREATE POLICY "Lecciones manage super_admin" ON public.academia_lecciones FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: recursos
CREATE POLICY "Recursos select" ON public.academia_recursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recursos manage super_admin" ON public.academia_recursos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: evaluaciones
CREATE POLICY "Evals select" ON public.academia_evaluaciones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.academia_modulos m JOIN public.academia_cursos c ON c.id = m.curso_id
    WHERE m.id = modulo_id AND (
      public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'gerencia'::app_role)
      OR (c.activo AND c.rol_destino = public.academia_rol_del_usuario(auth.uid()))
    )
  ));
CREATE POLICY "Evals manage super_admin" ON public.academia_evaluaciones FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: preguntas
CREATE POLICY "Preguntas select" ON public.academia_preguntas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Preguntas manage super_admin" ON public.academia_preguntas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: intentos
CREATE POLICY "Intentos insert propio" ON public.academia_intentos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Intentos select propio o manager" ON public.academia_intentos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'gerencia'::app_role));

-- POLICIES: progreso
CREATE POLICY "Progreso manage propio" ON public.academia_progreso_lecciones FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- POLICIES: certificaciones
CREATE POLICY "Cert select propio o manager" ON public.academia_certificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "Cert insert propio o super" ON public.academia_certificaciones FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
-- vista pública por código (autenticados)
CREATE POLICY "Cert select por codigo" ON public.academia_certificaciones FOR SELECT TO authenticated USING (true);

-- POLICIES: modulo_ayuda
CREATE POLICY "Ayuda select autenticados" ON public.modulo_ayuda FOR SELECT TO authenticated USING (activo);
CREATE POLICY "Ayuda manage super_admin" ON public.modulo_ayuda FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Función emisión certificado
CREATE OR REPLACE FUNCTION public.intentar_emitir_certificado(_user_id uuid, _curso_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_lecciones int;
  v_completadas int;
  v_total_evals int;
  v_aprobadas int;
  v_prom numeric(5,2);
  v_codigo text;
  v_cert_id uuid;
BEGIN
  SELECT count(*) INTO v_total_lecciones
    FROM public.academia_lecciones l
    JOIN public.academia_modulos m ON m.id = l.modulo_id
    WHERE m.curso_id = _curso_id AND l.activo AND m.activo;

  SELECT count(*) INTO v_completadas
    FROM public.academia_progreso_lecciones p
    JOIN public.academia_lecciones l ON l.id = p.leccion_id
    JOIN public.academia_modulos m ON m.id = l.modulo_id
    WHERE m.curso_id = _curso_id AND p.user_id = _user_id AND p.completada;

  SELECT count(*) INTO v_total_evals
    FROM public.academia_evaluaciones e
    JOIN public.academia_modulos m ON m.id = e.modulo_id
    WHERE m.curso_id = _curso_id AND e.activo AND m.activo;

  SELECT count(DISTINCT i.evaluacion_id), COALESCE(AVG(i.porcentaje),0)
    INTO v_aprobadas, v_prom
    FROM public.academia_intentos i
    JOIN public.academia_evaluaciones e ON e.id = i.evaluacion_id
    JOIN public.academia_modulos m ON m.id = e.modulo_id
    WHERE m.curso_id = _curso_id AND i.user_id = _user_id AND i.aprobado;

  IF v_total_lecciones = 0 OR v_completadas < v_total_lecciones THEN RETURN NULL; END IF;
  IF v_total_evals > 0 AND v_aprobadas < v_total_evals THEN RETURN NULL; END IF;
  IF v_prom < 80 THEN RETURN NULL; END IF;

  v_codigo := 'NUVEX-' || upper(substr(md5(_user_id::text || _curso_id::text || now()::text),1,10));

  INSERT INTO public.academia_certificaciones (user_id, curso_id, nota_final, codigo)
  VALUES (_user_id, _curso_id, v_prom, v_codigo)
  ON CONFLICT (user_id, curso_id) DO UPDATE SET nota_final = EXCLUDED.nota_final
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END $$;

-- Seed cursos vacíos
INSERT INTO public.academia_cursos (rol_destino, titulo, descripcion, orden) VALUES
  ('licenciado','Academia Licenciado','Formación para licenciados NUVEX',10),
  ('operaciones','Academia Operaciones','Formación para el equipo de operaciones',20),
  ('juridica','Academia Jurídica','Formación para el equipo jurídico',30),
  ('contabilidad','Academia Contabilidad','Formación para contabilidad y cartera',40),
  ('director_financiero_qa','Academia Director Financiero QA','Formación para validación financiera y QA',50),
  ('gerencia','Academia Gerencia','Formación estratégica para gerencia',60),
  ('super_admin','Academia Super Admin','Operación integral del sistema NUVEX',70)
ON CONFLICT DO NOTHING;
