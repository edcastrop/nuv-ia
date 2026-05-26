
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE TABLE public.nuvex_kb (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'activo',
  creado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nuvex_kb_estado_chk CHECK (estado IN ('activo','borrador','archivado'))
);

CREATE INDEX idx_nuvex_kb_categoria ON public.nuvex_kb (categoria);
CREATE INDEX idx_nuvex_kb_estado ON public.nuvex_kb (estado);
CREATE INDEX idx_nuvex_kb_tags ON public.nuvex_kb USING GIN (tags);
CREATE INDEX idx_nuvex_kb_pregunta_trgm ON public.nuvex_kb USING GIN (pregunta public.gin_trgm_ops);
CREATE INDEX idx_nuvex_kb_respuesta_trgm ON public.nuvex_kb USING GIN (respuesta public.gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nuvex_kb TO authenticated;
GRANT ALL ON public.nuvex_kb TO service_role;

ALTER TABLE public.nuvex_kb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nuvex_kb select autenticados" ON public.nuvex_kb FOR SELECT TO authenticated USING (true);
CREATE POLICY "nuvex_kb insert managers" ON public.nuvex_kb FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "nuvex_kb update managers" ON public.nuvex_kb FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "nuvex_kb delete super_admin" ON public.nuvex_kb FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_nuvex_kb_updated_at BEFORE UPDATE ON public.nuvex_kb
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nuvex_ia_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID,
  nombre_usuario TEXT,
  rol TEXT,
  modulo TEXT,
  pregunta TEXT NOT NULL,
  respuesta TEXT,
  origen TEXT NOT NULL DEFAULT 'nuvex_ia',
  fuente TEXT NOT NULL DEFAULT 'modelo',
  tiempo_respuesta_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nuvex_ia_log_origen_chk CHECK (origen IN ('nuvex_ia','nuvex_gpt','cliente')),
  CONSTRAINT nuvex_ia_log_fuente_chk CHECK (fuente IN ('kb','modelo','escalado'))
);

CREATE INDEX idx_nuvex_ia_log_usuario ON public.nuvex_ia_log (usuario_id);
CREATE INDEX idx_nuvex_ia_log_created ON public.nuvex_ia_log (created_at DESC);
CREATE INDEX idx_nuvex_ia_log_origen ON public.nuvex_ia_log (origen);

GRANT SELECT, INSERT ON public.nuvex_ia_log TO authenticated;
GRANT ALL ON public.nuvex_ia_log TO service_role;

ALTER TABLE public.nuvex_ia_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nuvex_ia_log select propio o manager" ON public.nuvex_ia_log FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerencia'::app_role));
CREATE POLICY "nuvex_ia_log insert auth" ON public.nuvex_ia_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.nuvex_kb (categoria, pregunta, respuesta, tags, estado) VALUES
('Ley 546 de 1999','¿Qué es la Ley 546 de 1999?','La Ley 546 de 1999 regula el sistema de financiación de vivienda en Colombia. Pendiente de redacción completa por el equipo NUVEX.','{ley,546,vivienda}','borrador'),
('Decreto 583 de 2025','¿Qué es el Decreto 583 de 2025?','Decreto reciente sobre vivienda. Pendiente de redacción.','{decreto,583}','borrador'),
('Matemática Financiera','¿Qué es matemática financiera?','Disciplina que estudia el valor del dinero en el tiempo. Pendiente.','{matematica,financiera}','borrador'),
('Sistemas de Amortización','¿Qué sistemas de amortización existen?','Cuota fija, abono constante, UVR, cíclica decreciente. Pendiente.','{amortizacion}','borrador'),
('Simulador NUVEX','¿Cómo uso el Simulador NUVEX?','Pasos del simulador. Pendiente.','{simulador}','borrador'),
('OCR NUVEX','¿Cómo funciona el OCR de NUVEX?','El OCR lee extractos bancarios automáticamente. Pendiente.','{ocr,extractos}','borrador'),
('Expediente Maestro','¿Qué es el Expediente Maestro?','Repositorio único de información del caso. Pendiente.','{expediente,maestro}','borrador'),
('Casos','¿Cómo creo un caso?','Pasos para crear un caso en NUVEX. Pendiente.','{casos}','borrador'),
('Estados del Caso','¿Cuáles son los estados de un caso?','Lead, simulado, contratado, radicado, aprobado, etc. Pendiente.','{estados,caso}','borrador'),
('Estados del Expediente','¿Cuáles son los estados del expediente?','SIMULADO, FIRMADO, RADICADO, APROBADO, CONDICIONES_APLICADAS, FACTURADO, PAGADO. Pendiente.','{estados,expediente}','borrador'),
('Comercial','¿Cómo abordar un cliente nuevo?','Guion comercial. Pendiente.','{comercial}','borrador'),
('Objeciones','¿Cómo manejar objeciones?','Listado de objeciones frecuentes. Pendiente.','{objeciones}','borrador'),
('Contratación','¿Cómo se envía a contratación?','Proceso de envío. Pendiente.','{contratacion}','borrador'),
('Jurídica','¿Cuándo escalar a jurídica?','Casos que requieren equipo jurídico. Pendiente.','{juridica}','borrador'),
('Poderes','¿Cómo generar un poder?','Pasos. Pendiente.','{poderes}','borrador'),
('Contratos','¿Cómo se genera un contrato?','Pasos. Pendiente.','{contratos}','borrador'),
('Derechos de Petición','¿Cuándo radicar un derecho de petición?','Pendiente.','{derecho,peticion}','borrador'),
('Tutelas','¿Cuándo procede una tutela?','Pendiente.','{tutela}','borrador'),
('Operaciones','¿Qué hace el equipo de operaciones?','Pendiente.','{operaciones}','borrador'),
('Bancos','¿Con qué bancos trabajamos?','Listado de bancos aliados. Pendiente.','{bancos}','borrador'),
('Fresh','¿Qué es Fresh?','Producto financiero. Pendiente.','{fresh}','borrador'),
('Coberturas','¿Qué coberturas maneja NUVEX?','Pendiente.','{coberturas}','borrador'),
('Cartera','¿Cómo funciona el módulo de Cartera?','Pendiente.','{cartera}','borrador'),
('Honorarios','¿Cómo se calculan los honorarios?','Pendiente.','{honorarios}','borrador'),
('Comisiones','¿Cómo se generan las comisiones?','Las comisiones se liberan al recaudar honorarios. Pendiente.','{comisiones}','borrador'),
('Cuentas de Cobro','¿Cómo genero una cuenta de cobro?','Pendiente.','{cuenta,cobro}','borrador'),
('Academia NUVEX','¿Qué es Academia NUVEX?','Plataforma interna de capacitación. Pendiente.','{academia}','borrador'),
('Roles y Permisos','¿Qué rol tengo y qué puedo hacer?','Depende del rol asignado. Pendiente.','{roles,permisos}','borrador'),
('Procesos Internos','¿Cuáles son los procesos internos?','Pendiente.','{procesos}','borrador'),
('Preguntas Frecuentes','¿Dónde encuentro ayuda?','En NUVEX GPT (botón flotante) o NUVEX IA (página completa).','{faq,ayuda}','activo');
