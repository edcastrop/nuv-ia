-- Singleton brand config table
CREATE TABLE IF NOT EXISTS public.brand_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  nombre_comercial text NOT NULL DEFAULT 'NUVEX Finanzas Inteligentes',
  tagline text NOT NULL DEFAULT 'Finanzas Inteligentes',
  sitio_web text NOT NULL DEFAULT 'www.nuvex.com.co',
  correo_juridica text NOT NULL DEFAULT 'juridica@nuvex.com.co',
  correo_contratacion text NOT NULL DEFAULT 'contratacion@nuvex.com.co',
  direccion_bucaramanga text NOT NULL DEFAULT 'Carrera 16 # 37-48 Piso 4, Centro de Bucaramanga',
  direccion_bogota text NOT NULL DEFAULT 'Calle 93 # 18-28 Oficina 704',
  color_azul text NOT NULL DEFAULT '#445DA3',
  color_verde text NOT NULL DEFAULT '#84B98F',
  color_negro text NOT NULL DEFAULT '#242424',
  logo_url text NOT NULL DEFAULT 'https://sistema-nuvex.lovable.app/logo-nuvex.png',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.brand_config (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.brand_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand config viewable by authenticated"
ON public.brand_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Brand config editable by super admin"
ON public.brand_config FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER brand_config_set_updated_at
BEFORE UPDATE ON public.brand_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();