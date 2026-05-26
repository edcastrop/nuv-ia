
-- ====== GPT KB CATEGORIAS ======
CREATE TABLE public.gpt_kb_categorias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_kb_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cat select autenticados" ON public.gpt_kb_categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cat manage super_admin gerencia" ON public.gpt_kb_categorias
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

-- ====== GPT KB ARTICULOS ======
CREATE TABLE public.gpt_kb_articulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id uuid NOT NULL REFERENCES public.gpt_kb_categorias(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  roles_permitidos text[] NOT NULL DEFAULT '{}', -- vacío = todos
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_kb_articulos ENABLE ROW LEVEL SECURITY;
CREATE INDEX gpt_kb_articulos_categoria_idx ON public.gpt_kb_articulos(categoria_id);
CREATE INDEX gpt_kb_articulos_tags_idx ON public.gpt_kb_articulos USING GIN(tags);

CREATE POLICY "Articulos select autenticados" ON public.gpt_kb_articulos
  FOR SELECT TO authenticated USING (activo = true);
CREATE POLICY "Articulos manage super_admin gerencia" ON public.gpt_kb_articulos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

-- ====== CONVERSACIONES ======
CREATE TABLE public.gpt_conversaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Nueva conversación',
  modulo_contexto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_conversaciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX gpt_conv_user_idx ON public.gpt_conversaciones(user_id, updated_at DESC);

CREATE POLICY "Conv owner select" ON public.gpt_conversaciones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Conv owner insert" ON public.gpt_conversaciones
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Conv owner update" ON public.gpt_conversaciones
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Conv owner delete" ON public.gpt_conversaciones
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));

-- ====== MENSAJES ======
CREATE TABLE public.gpt_mensajes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id uuid NOT NULL REFERENCES public.gpt_conversaciones(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_mensajes ENABLE ROW LEVEL SECURITY;
CREATE INDEX gpt_msg_conv_idx ON public.gpt_mensajes(conversacion_id, created_at);

CREATE POLICY "Msg select por conv" ON public.gpt_mensajes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gpt_conversaciones c
      WHERE c.id = gpt_mensajes.conversacion_id
        AND (c.user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role)))
  );
CREATE POLICY "Msg insert por conv" ON public.gpt_mensajes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.gpt_conversaciones c
      WHERE c.id = gpt_mensajes.conversacion_id AND c.user_id = auth.uid())
  );

-- ====== TICKETS ======
CREATE TABLE public.gpt_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversacion_id uuid REFERENCES public.gpt_conversaciones(id) ON DELETE SET NULL,
  area text NOT NULL CHECK (area IN ('juridica','operaciones','contabilidad','director_qa','soporte')),
  asunto text NOT NULL,
  descripcion text NOT NULL,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','en_proceso','resuelto','cerrado')),
  prioridad text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','urgente')),
  asignado_a uuid,
  resuelto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX gpt_tickets_user_idx ON public.gpt_tickets(user_id, created_at DESC);
CREATE INDEX gpt_tickets_area_idx ON public.gpt_tickets(area, estado);

CREATE OR REPLACE FUNCTION public.gpt_can_see_ticket(_user uuid, _area text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(_user,'super_admin'::app_role)
    OR has_role(_user,'admin'::app_role)
    OR has_role(_user,'gerencia'::app_role)
    OR (
      CASE _area
        WHEN 'juridica' THEN has_role(_user,'juridica'::app_role) OR has_role(_user,'director_juridico'::app_role)
        WHEN 'operaciones' THEN has_role(_user,'operaciones'::app_role) OR has_role(_user,'auxiliar_operativo'::app_role)
        WHEN 'contabilidad' THEN has_role(_user,'contabilidad'::app_role)
        WHEN 'director_qa' THEN has_role(_user,'director_financiero_qa'::app_role)
        WHEN 'soporte' THEN has_role(_user,'super_admin'::app_role)
        ELSE false
      END
    )
$$;

CREATE POLICY "Tickets select owner/area/manager" ON public.gpt_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.gpt_can_see_ticket(auth.uid(), area));
CREATE POLICY "Tickets insert owner" ON public.gpt_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Tickets update area/manager" ON public.gpt_tickets
  FOR UPDATE TO authenticated
  USING (public.gpt_can_see_ticket(auth.uid(), area));

-- ====== CONSULTAS LOG ======
CREATE TABLE public.gpt_consultas_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  rol text,
  modulo text,
  pregunta text NOT NULL,
  categoria_detectada text,
  respondida boolean NOT NULL DEFAULT true,
  feedback smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gpt_consultas_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX gpt_log_created_idx ON public.gpt_consultas_log(created_at DESC);

CREATE POLICY "Log insert auth" ON public.gpt_consultas_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Log select managers" ON public.gpt_consultas_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerencia'::app_role));

-- ====== TRIGGERS updated_at ======
CREATE TRIGGER trg_gpt_kb_cat_upd BEFORE UPDATE ON public.gpt_kb_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_gpt_kb_art_upd BEFORE UPDATE ON public.gpt_kb_articulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_gpt_conv_upd BEFORE UPDATE ON public.gpt_conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_gpt_tickets_upd BEFORE UPDATE ON public.gpt_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== SEED CATEGORIAS ======
INSERT INTO public.gpt_kb_categorias (nombre, orden) VALUES
  ('Ley 546 de 1999', 1),
  ('Decreto 583 de 2025', 2),
  ('Matemática Financiera', 3),
  ('Sistemas de Amortización', 4),
  ('Simulador NUVEX', 5),
  ('OCR NUVEX', 6),
  ('Expediente Maestro', 7),
  ('Casos', 8),
  ('Estados del Caso', 9),
  ('Estados del Expediente', 10),
  ('Comercial', 11),
  ('Objeciones', 12),
  ('Contratación', 13),
  ('Jurídica', 14),
  ('Poderes', 15),
  ('Contratos', 16),
  ('Derechos de Petición', 17),
  ('Tutelas', 18),
  ('Operaciones', 19),
  ('Bancos', 20),
  ('Fresh', 21),
  ('Coberturas', 22),
  ('Cartera', 23),
  ('Honorarios', 24),
  ('Comisiones', 25),
  ('Cuentas de Cobro', 26),
  ('Academia NUVEX', 27),
  ('Roles y Permisos', 28),
  ('Procesos Internos', 29),
  ('Preguntas Frecuentes', 30);

-- ====== SEED ARTICULOS ======
INSERT INTO public.gpt_kb_articulos (categoria_id, titulo, contenido, tags) VALUES
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Ley 546 de 1999'),
 'Ley 546 de 1999 — Marco general',
 E'La Ley 546 de 1999 reglamenta el sistema especializado de financiación de vivienda de largo plazo en Colombia.\n\n**Puntos clave:**\n- Crea las UVR (Unidad de Valor Real).\n- Regula la titularización hipotecaria.\n- Define la relación cuota-ingreso máxima del **30%**.\n- Permite reliquidación de créditos hipotecarios.\n\n**Aplicación en NUVEX:** todas las simulaciones de crédito hipotecario deben validar el cumplimiento de la relación cuota-ingreso conforme a esta ley.',
 ARRAY['ley546','hipotecario','uvr','cuota-ingreso']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Ley 546 de 1999'),
 'Artículo 17 — Reliquidación de créditos hipotecarios',
 E'El **artículo 17 de la Ley 546** establece las condiciones bajo las cuales un crédito hipotecario puede ser reliquidado, principalmente cuando el deudor demuestra capacidad de pago afectada por cambios en la tasa o el sistema de amortización.\n\n**Aplicación operativa:**\n1. Identificar el tipo de crédito (UVR o pesos).\n2. Verificar si aplica reliquidación según las condiciones originales.\n3. Solicitar al banco la reliquidación formal.\n4. Documentar el caso en el Expediente Maestro.',
 ARRAY['ley546','articulo17','reliquidacion']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Decreto 583 de 2025'),
 'Decreto 583 de 2025 — Capacidad de pago al 40%',
 E'El **Decreto 583 de 2025** amplía la capacidad de pago para créditos hipotecarios y leasing habitacional al **40% de los ingresos netos** del deudor, bajo ciertas condiciones de respaldo.\n\n**Aplicación NUVEX:**\n- El Simulador NUVEX usa este umbral cuando el cliente lo solicita explícitamente y cumple requisitos.\n- El Director Financiero QA debe validar cada caso que use este umbral antes de generar propuesta.',
 ARRAY['decreto583','capacidad-pago','40']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Fresh'),
 '¿Qué es Fresh?',
 E'**Fresh** es el dinero líquido que recibe el cliente al cierre del crédito hipotecario o leasing habitacional, una vez se cubren los honorarios, seguros y demás conceptos pactados.\n\n**Fórmula:**\n`Fresh = Desembolso Banco − Saldo a cancelar − Honorarios NUVEX − Seguros − Otros`\n\n**Importante:** el Fresh es la métrica central de valor para el cliente — es el dinero "fresco" que se le entrega.',
 ARRAY['fresh','desembolso','liquidez']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Simulador NUVEX'),
 '¿Cómo genero una simulación?',
 E'**Pasos para generar una simulación en NUVEX:**\n\n1. Ingresa al módulo **Simulador** desde el menú principal.\n2. Sube el extracto bancario del cliente (PDF) — el OCR NUVEX extraerá los datos.\n3. Verifica que los datos extraídos sean correctos: banco, producto, TEA, cuota, saldo, cuotas pendientes.\n4. Completa los datos del cliente (cédula, nombre, ingresos).\n5. Selecciona el banco destino y producto deseado.\n6. Haz clic en **Calcular** para ver Fresh, ahorro mensual y nueva cuota.\n7. Si la propuesta es viable, guarda como Caso para continuar con la contratación.',
 ARRAY['simulacion','simulador','paso-a-paso']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Cuentas de Cobro'),
 '¿Cómo genero una cuenta de cobro?',
 E'**Pasos para generar una cuenta de cobro:**\n\n1. Ve al módulo **Comisiones** o **Contabilidad → Cuentas de Cobro**.\n2. Selecciona las comisiones liberadas que vas a cobrar (estado: comisión_liberada).\n3. Haz clic en **Generar cuenta de cobro**.\n4. Verifica los datos del titular, banco, número de cuenta y total.\n5. Envía la cuenta de cobro a Contabilidad (estado pasa a **enviada**).\n6. Contabilidad la aprueba o devuelve con motivo.\n7. Una vez aprobada, se programa el pago.',
 ARRAY['cuenta-cobro','contabilidad','comisiones']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Comisiones'),
 '¿Cómo funciona una comisión financiada?',
 E'Una **comisión financiada** se libera proporcionalmente al recaudo real del cliente:\n\n**Fórmula:**\n`comisión_liberada = comisión_potencial × (recaudado / honorarios_totales)`\n\n- Si los honorarios se pactan a 12 cuotas y el cliente paga 6, se libera el 50% de la comisión.\n- Si el banco aprueba menos cuotas que las pactadas, se aplica la **Regla de 3** para recalcular honorarios.\n\n**Importante:** la comisión NO se libera hasta que efectivamente entre el dinero a la cuenta receptora de NUVEX.',
 ARRAY['comision','financiada','regla-de-3']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Operaciones'),
 '¿Qué hago si el banco devuelve el caso?',
 E'**Pasos cuando un banco devuelve un caso:**\n\n1. Lee con atención el motivo de la devolución en el correo del banco.\n2. Clasifica el motivo: documental, financiero, de viabilidad, o de fraude.\n3. Si es documental: solicita al cliente el documento faltante o corregido y reenvía.\n4. Si es financiero: revisa la simulación, considera ajustar plazo o cuota.\n5. Si es de viabilidad: escala al Director Financiero QA.\n6. Registra el submotivo en el Expediente Maestro y cambia el estado del caso a **devuelto_banco**.\n7. Notifica al cliente con plan de acción claro.',
 ARRAY['devolucion','banco','operaciones']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Poderes'),
 '¿Cómo genero un poder?',
 E'**Pasos para generar un poder en NUVEX:**\n\n1. Abre el Expediente Maestro del cliente.\n2. Ve a la sección **Jurídica → Poderes**.\n3. Selecciona el apoderado asignado (predeterminado por banco o general).\n4. Genera el poder con la plantilla NUVEX correspondiente al banco destino.\n5. Descarga el PDF y envíalo al cliente para firma.\n6. Sube el poder firmado a **Soportes → Jurídica**.\n7. El poder queda disponible para Jurídica y Operaciones.',
 ARRAY['poder','juridica','apoderado']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Matemática Financiera'),
 '¿Cómo interpretar una TEA?',
 E'La **TEA (Tasa Efectiva Anual)** es la tasa real anual de un crédito, considerando capitalización de intereses.\n\n**Conversión a tasa mensual efectiva:**\n`i_mensual = (1 + TEA)^(1/12) − 1`\n\n**Ejemplo:** TEA 12% anual → i_mensual ≈ 0.9489%.\n\n**Uso en NUVEX:** siempre compara la TEA del banco actual del cliente vs. la TEA del banco destino para calcular el ahorro real mensual y total.',
 ARRAY['tea','tasa','matematica-financiera']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='OCR NUVEX'),
 '¿Cómo subo un extracto?',
 E'**Pasos para subir un extracto bancario al OCR NUVEX:**\n\n1. Entra al **Simulador** o al **Expediente Maestro** del cliente.\n2. Haz clic en **Subir extracto** y selecciona el PDF del banco.\n3. Espera a que el OCR procese el documento (suele tomar 5-15 segundos).\n4. Verifica cada campo extraído: banco, producto, TEA, cuota, saldo, fecha, cuotas pendientes, seguros, Fresh.\n5. Corrige manualmente cualquier dato que el OCR haya marcado con confianza baja.\n6. Aprueba la lectura para usarla en la simulación.\n\n**Tip:** entre mejor calidad tenga el PDF, más alta será la confianza del OCR.',
 ARRAY['ocr','extracto','simulador']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Cartera'),
 'Estados de Cartera',
 E'Los estados posibles en el módulo **Cartera** son:\n\n- **pendiente_cobro**: aún no se ha generado cuenta de cobro.\n- **en_cobro**: cuenta de cobro enviada al banco/cliente.\n- **pagada_parcial**: se recibió pago parcial.\n- **pagada_total**: el cliente cubrió el 100% de los honorarios.\n- **acuerdo_pago**: se pactó acuerdo de pago con cuotas.\n- **mora**: vencida sin pago.\n- **incobrable**: declarada incobrable por el Comité.',
 ARRAY['cartera','estados']),
((SELECT id FROM public.gpt_kb_categorias WHERE nombre='Expediente Maestro'),
 '¿Cómo creo un expediente?',
 E'**Pasos para crear un Expediente Maestro:**\n\n1. Genera primero una simulación viable en el Simulador.\n2. Desde la simulación, haz clic en **Convertir a Caso**.\n3. Completa los datos del cliente (cédula, nombre completo, contacto).\n4. Si hay cotitular, agrégalo en la sección correspondiente.\n5. Asigna apoderado y datos del crédito destino.\n6. Sube los soportes iniciales (cédula, certificado laboral, extractos).\n7. Cambia el estado a **lead_calificado** o **simulacion_aprobada**.\n8. El Expediente Maestro queda activo y se sincroniza con el caso.',
 ARRAY['expediente','crear']);

