
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'asesor');
CREATE TYPE public.expediente_estado AS ENUM ('SIMULADO','FIRMADO','RADICADO','APROBADO','FACTURADO','PAGADO');
CREATE TYPE public.expediente_modo AS ENUM ('pesos','uvr');

-- ============ TIMESTAMP TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by owner" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles update by owner" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles insert by self" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  -- default role: asesor
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'asesor')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Now register the auth trigger (after user_roles exists)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ EXPEDIENTES ============
CREATE TABLE public.expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modo public.expediente_modo NOT NULL,
  cliente_nombre TEXT NOT NULL,
  cedula TEXT,
  banco TEXT,
  numero_credito TEXT,
  producto TEXT,
  cliente_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  credito_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  propuesta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  discount_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  honorarios_base NUMERIC(15,2) DEFAULT 0,
  honorarios_final NUMERIC(15,2) DEFAULT 0,
  descuento NUMERIC(15,2) DEFAULT 0,
  estado public.expediente_estado NOT NULL DEFAULT 'SIMULADO',
  fecha_simulacion DATE NOT NULL DEFAULT CURRENT_DATE,
  aprobado_data JSONB,
  acertividad_global NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expedientes_asesor ON public.expedientes(asesor_id);
CREATE INDEX idx_expedientes_estado ON public.expedientes(estado);
CREATE INDEX idx_expedientes_cedula ON public.expedientes(cedula);
CREATE INDEX idx_expedientes_search ON public.expedientes USING GIN (
  to_tsvector('simple', coalesce(cliente_nombre,'') || ' ' || coalesce(cedula,'') || ' ' || coalesce(numero_credito,'') || ' ' || coalesce(banco,''))
);

CREATE POLICY "Asesor sees own expedientes" ON public.expedientes
  FOR SELECT USING (auth.uid() = asesor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Asesor inserts own expedientes" ON public.expedientes
  FOR INSERT WITH CHECK (auth.uid() = asesor_id);
CREATE POLICY "Asesor updates own expedientes" ON public.expedientes
  FOR UPDATE USING (auth.uid() = asesor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Asesor deletes own expedientes" ON public.expedientes
  FOR DELETE USING (auth.uid() = asesor_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_expedientes_updated_at
  BEFORE UPDATE ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HISTORIAL ============
CREATE TABLE public.expediente_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  estado_anterior public.expediente_estado,
  estado_nuevo public.expediente_estado NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expediente_historial ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_historial_expediente ON public.expediente_historial(expediente_id);

CREATE POLICY "Historial visible si expediente visible" ON public.expediente_historial
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND (e.asesor_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Historial insert por owner" ON public.expediente_historial
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.expedientes e WHERE e.id = expediente_id AND (e.asesor_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
