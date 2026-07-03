-- ============================================================
-- NUVIA QA Copilot: KB + conversaciones + sugerencias
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- Helper de roles permitidos ----------
CREATE OR REPLACE FUNCTION public.nuvia_qa_copilot_puede_usar(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text IN (
        'super_admin','admin','gerencia',
        'director_financiero_qa',
        'analista_financiero','analista_financiero_comercial'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.nuvia_qa_copilot_es_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role::text IN ('super_admin','admin','gerencia')
  );
$$;

-- ============================================================
-- KB semántica
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nuvia_qa_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  fuente TEXT,
  banco TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nuvia_qa_kb_categoria_idx ON public.nuvia_qa_kb (categoria);
CREATE INDEX IF NOT EXISTS nuvia_qa_kb_banco_idx ON public.nuvia_qa_kb (banco);
CREATE INDEX IF NOT EXISTS nuvia_qa_kb_embed_idx
  ON public.nuvia_qa_kb USING hnsw (embedding vector_cosine_ops);

GRANT SELECT ON public.nuvia_qa_kb TO authenticated;
GRANT ALL ON public.nuvia_qa_kb TO service_role;
ALTER TABLE public.nuvia_qa_kb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb read autorizados" ON public.nuvia_qa_kb
FOR SELECT TO authenticated
USING (public.nuvia_qa_copilot_puede_usar(auth.uid()));

CREATE POLICY "kb write admins" ON public.nuvia_qa_kb
FOR ALL TO authenticated
USING (public.nuvia_qa_copilot_es_admin(auth.uid()))
WITH CHECK (public.nuvia_qa_copilot_es_admin(auth.uid()));

-- RPC de búsqueda semántica
CREATE OR REPLACE FUNCTION public.match_nuvia_kb(
  query_embedding vector(1536),
  match_count int DEFAULT 6,
  filter_categoria text DEFAULT NULL,
  filter_banco text DEFAULT NULL
)
RETURNS TABLE (
  id UUID, categoria TEXT, titulo TEXT, contenido TEXT,
  fuente TEXT, banco TEXT, metadata JSONB, similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT k.id, k.categoria, k.titulo, k.contenido, k.fuente, k.banco, k.metadata,
         1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.nuvia_qa_kb k
  WHERE k.activo = true
    AND k.embedding IS NOT NULL
    AND (filter_categoria IS NULL OR k.categoria = filter_categoria)
    AND (filter_banco IS NULL OR k.banco = filter_banco)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- Tablas de referencia estructurada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nuvia_usura_mensual (
  fecha DATE PRIMARY KEY,
  modalidad TEXT NOT NULL DEFAULT 'consumo_ordinario',
  tasa_usura_ea NUMERIC NOT NULL,
  interes_bancario_corriente_ea NUMERIC,
  fuente TEXT DEFAULT 'SFC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nuvia_usura_mensual TO authenticated;
GRANT ALL ON public.nuvia_usura_mensual TO service_role;
ALTER TABLE public.nuvia_usura_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usura read autorizados" ON public.nuvia_usura_mensual
FOR SELECT TO authenticated USING (public.nuvia_qa_copilot_puede_usar(auth.uid()));
CREATE POLICY "usura write admins" ON public.nuvia_usura_mensual
FOR ALL TO authenticated
USING (public.nuvia_qa_copilot_es_admin(auth.uid()))
WITH CHECK (public.nuvia_qa_copilot_es_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.nuvia_uvr_mensual (
  fecha DATE PRIMARY KEY,
  valor NUMERIC NOT NULL,
  fuente TEXT DEFAULT 'Banrep',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nuvia_uvr_mensual TO authenticated;
GRANT ALL ON public.nuvia_uvr_mensual TO service_role;
ALTER TABLE public.nuvia_uvr_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uvr read autorizados" ON public.nuvia_uvr_mensual
FOR SELECT TO authenticated USING (public.nuvia_qa_copilot_puede_usar(auth.uid()));
CREATE POLICY "uvr write admins" ON public.nuvia_uvr_mensual
FOR ALL TO authenticated
USING (public.nuvia_qa_copilot_es_admin(auth.uid()))
WITH CHECK (public.nuvia_qa_copilot_es_admin(auth.uid()));

-- ============================================================
-- Conversaciones y mensajes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nuvia_qa_copilot_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  auditoria_id UUID,
  titulo TEXT NOT NULL DEFAULT 'Nueva conversación',
  contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
  archivada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_copilot_conv_user_idx ON public.nuvia_qa_copilot_conversaciones (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS qa_copilot_conv_exp_idx ON public.nuvia_qa_copilot_conversaciones (expediente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nuvia_qa_copilot_conversaciones TO authenticated;
GRANT ALL ON public.nuvia_qa_copilot_conversaciones TO service_role;
ALTER TABLE public.nuvia_qa_copilot_conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv select propio o admin" ON public.nuvia_qa_copilot_conversaciones
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()));

CREATE POLICY "conv insert autorizado" ON public.nuvia_qa_copilot_conversaciones
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.nuvia_qa_copilot_puede_usar(auth.uid()));

CREATE POLICY "conv update propio o admin" ON public.nuvia_qa_copilot_conversaciones
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()));

CREATE POLICY "conv delete propio o admin" ON public.nuvia_qa_copilot_conversaciones
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.nuvia_qa_copilot_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES public.nuvia_qa_copilot_conversaciones(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  tool_name TEXT,
  citas JSONB,
  tokens INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_copilot_msg_conv_idx ON public.nuvia_qa_copilot_mensajes (conversacion_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nuvia_qa_copilot_mensajes TO authenticated;
GRANT ALL ON public.nuvia_qa_copilot_mensajes TO service_role;
ALTER TABLE public.nuvia_qa_copilot_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg select via conv" ON public.nuvia_qa_copilot_mensajes
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c
  WHERE c.id = conversacion_id
    AND (c.user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()))
));

CREATE POLICY "msg insert via conv" ON public.nuvia_qa_copilot_mensajes
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c
  WHERE c.id = conversacion_id AND c.user_id = auth.uid()
));

CREATE POLICY "msg delete via conv" ON public.nuvia_qa_copilot_mensajes
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c
  WHERE c.id = conversacion_id
    AND (c.user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()))
));

-- ============================================================
-- Sugerencias de dictamen (Director confirma)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nuvia_qa_copilot_sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES public.nuvia_qa_copilot_conversaciones(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES public.expedientes(id),
  auditoria_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('dictamen','ajuste_calculo','nota','alerta_normativa')),
  titulo TEXT NOT NULL,
  propuesta JSONB NOT NULL,
  justificacion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  creada_por UUID REFERENCES auth.users(id),
  aprobada_por UUID REFERENCES auth.users(id),
  aprobada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_copilot_sug_conv_idx ON public.nuvia_qa_copilot_sugerencias (conversacion_id);
CREATE INDEX IF NOT EXISTS qa_copilot_sug_estado_idx ON public.nuvia_qa_copilot_sugerencias (estado);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nuvia_qa_copilot_sugerencias TO authenticated;
GRANT ALL ON public.nuvia_qa_copilot_sugerencias TO service_role;
ALTER TABLE public.nuvia_qa_copilot_sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sug select via conv" ON public.nuvia_qa_copilot_sugerencias
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c
  WHERE c.id = conversacion_id
    AND (c.user_id = auth.uid() OR public.nuvia_qa_copilot_es_admin(auth.uid()))
));

CREATE POLICY "sug insert via conv" ON public.nuvia_qa_copilot_sugerencias
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c
  WHERE c.id = conversacion_id AND c.user_id = auth.uid()
));

CREATE POLICY "sug update director" ON public.nuvia_qa_copilot_sugerencias
FOR UPDATE TO authenticated
USING (
  public.nuvia_qa_copilot_es_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'director_financiero_qa')
  OR EXISTS (SELECT 1 FROM public.nuvia_qa_copilot_conversaciones c WHERE c.id = conversacion_id AND c.user_id = auth.uid())
);

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.nuvia_qa_copilot_touch() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_qa_kb_touch ON public.nuvia_qa_kb;
CREATE TRIGGER trg_qa_kb_touch BEFORE UPDATE ON public.nuvia_qa_kb
FOR EACH ROW EXECUTE FUNCTION public.nuvia_qa_copilot_touch();

DROP TRIGGER IF EXISTS trg_qa_conv_touch ON public.nuvia_qa_copilot_conversaciones;
CREATE TRIGGER trg_qa_conv_touch BEFORE UPDATE ON public.nuvia_qa_copilot_conversaciones
FOR EACH ROW EXECUTE FUNCTION public.nuvia_qa_copilot_touch();

-- ============================================================
-- Seed inicial: normativa + fórmulas + perfiles de banco
-- (contenido sin embeddings; se generan luego con job desde el backend)
-- ============================================================
INSERT INTO public.nuvia_qa_kb (categoria, titulo, contenido, fuente, banco, metadata) VALUES
('normativa','Ley 546 de 1999 — Crédito hipotecario UVR',
'Regula el crédito de vivienda en UVR en Colombia. Puntos clave para QA: (1) la cuota inicial y las tasas máximas están limitadas por la Superintendencia Financiera; (2) la reliquidación de créditos otorgados en UPAC/UVR debió aplicarse conforme a la sentencia C-955/2000; (3) para vivienda de interés social (VIS) la tasa máxima es 11% EA sobre UVR; para vivienda no VIS, 12,7% EA sobre UVR; (4) la cuota mensual no puede superar el 30% del ingreso familiar en la originación; (5) el crédito puede convertirse a pesos con abono a capital sin sanción.',
'Ley 546/1999, Corte Constitucional C-955/2000', NULL, '{"año":1999,"tipo":"ley"}'::jsonb),

('normativa','Circular Básica Jurídica SFC — Interés remuneratorio hipotecario',
'La Superintendencia Financiera fija topes de tasa de interés remuneratorio (moratorio = 1.5x remuneratorio, sin superar la usura). Para hipotecario en UVR: máximo 12,7% EA + UVR (11% VIS). Para hipotecario en pesos: máximo la tasa que resulte equivalente a UVR+12,7%. Cualquier tasa cobrada por encima constituye cobro indebido y NUVIA debe marcarlo como rechazo automático.',
'SFC — Circular Básica Jurídica, Título I, Cap. II', NULL, '{"tipo":"circular"}'::jsonb),

('normativa','Tasa de usura — cómputo mensual SFC',
'La tasa de usura equivale a 1.5 veces el interés bancario corriente (IBC) certificado mensualmente por la SFC. Cobrar por encima de la usura configura delito (art. 305 CP) y obliga a devolver el exceso. Para créditos hipotecarios individuales, aplica la modalidad "consumo y ordinario"; para leasing habitacional aplica la misma modalidad salvo pacto UVR (que se rige por Ley 546).',
'SFC, Código Penal art. 305', NULL, '{"tipo":"norma"}'::jsonb),

('normativa','UVR — cálculo diario Banrep',
'La UVR se calcula diariamente por el Banco de la República con base en la variación mensual del IPC del mes calendario anterior, distribuida geométricamente entre los días del período de cálculo (16 de un mes al 15 del siguiente). Fórmula: UVR_t = UVR_(t-1) * (1 + IPC_mensual)^(1/d), donde d es el número de días del período. La UVR NO puede aplicarse a créditos hipotecarios pactados en pesos.',
'Banrep — Res. Externa 13 de 2000', NULL, '{"tipo":"metodologia"}'::jsonb),

('formula','Amortización francesa — cuota fija',
'Cuota = P * (i * (1+i)^n) / ((1+i)^n - 1). Donde P = saldo inicial, i = tasa periódica (EA convertida a mensual: (1+EA)^(1/12)-1), n = número de cuotas. El saldo tras cuota k es: P_k = P * ((1+i)^n - (1+i)^k) / ((1+i)^n - 1). Aporte a capital en cuota k = Cuota - P_(k-1)*i.',
'Matemática financiera estándar', NULL, '{"tipo":"formula"}'::jsonb),

('formula','Conversión de tasas — EA ↔ NM ↔ NA ↔ Periódica',
'EA → Nominal mensual capitalizable mensualmente: NM = 12*((1+EA)^(1/12) - 1). EA → Nominal anual capitalizable mensualmente: idéntico a NM (es la misma tasa nominal). Periódica mensual → EA: EA = (1+i_m)^12 - 1. Tasa vencida ↔ anticipada: i_ant = i_ven/(1+i_ven).',
'Matemática financiera estándar', NULL, '{"tipo":"formula"}'::jsonb),

('formula','UVR → COP y viceversa',
'Valor cuota en COP en fecha t = Cuota_UVR * UVR_t. Saldo en COP en fecha t = Saldo_UVR * UVR_t. La cuota en UVR es constante (o crece por reajuste); la cuota en COP crece con la UVR. Para verificar coherencia: (Saldo_COP_extracto / UVR_fecha_extracto) debe aproximar el saldo UVR reportado con tolerancia < 0,1%.',
'Matemática financiera estándar', NULL, '{"tipo":"formula"}'::jsonb),

('banco','Davivienda — Perfil hipotecario',
'Ofrece hipotecario Pesos y UVR, además de Leasing Habitacional. Particularidades QA: (1) Seguros de vida y todo riesgo suelen facturarse por producto con tarifa vigente al corte, no proporcional al saldo del periodo; (2) en Hipotecario, la línea "+ Seguros" del "Nuevo Saldo" del extracto es el total de seguros del mes, no un detalle desglosado; (3) tasa subsidiada FRECH descuenta hasta 5 pp durante los primeros 7 años en VIS; (4) capitalización de intereses NO permitida en hipotecario individual (sí en algunos leasing).',
'Davivienda — Condiciones generales', 'Davivienda', '{"productos":["hipotecario","uvr","leasing_habitacional"]}'::jsonb),

('banco','Banco de Bogotá — Perfil hipotecario',
'Hipotecario en Pesos principalmente, tasa fija por tramos. QA: (1) el extracto separa TEA pactada y TEA cobrada; siempre priorizar TEA pactada para verificar el cálculo del periodo, la cobrada puede reflejar subsidio temporal; (2) los seguros aparecen como "seguros del período" en línea aparte y son proporcionales a saldo capital al inicio del periodo; (3) puede aplicar tasa preferencial para nómina (descuento hasta 1 pp) que se pierde si el cliente cambia de banco pagador.',
'Banco de Bogotá', 'Banco de Bogotá', '{"productos":["hipotecario"]}'::jsonb),

('banco','Bancolombia — Perfil hipotecario',
'Hipotecario Pesos y UVR. QA: (1) el extracto muestra tasa nominal mes vencido y su equivalente EA; convertir siempre a EA para comparar con pactada; (2) el seguro de vida es sobre saldo insoluto (mensual, decreciente); (3) el seguro todo riesgo es sobre valor asegurable de la propiedad (fijo mensual con ajuste anual IPC); (4) los abonos extraordinarios reducen plazo por defecto salvo instrucción escrita del cliente.',
'Bancolombia', 'Bancolombia', '{"productos":["hipotecario","uvr"]}'::jsonb),

('banco','BBVA — Perfil hipotecario',
'Hipotecario Pesos y UVR con opción de cuota escalonada. QA: (1) valida siempre el tipo de cuota (fija vs escalonada) porque cambia la fórmula de proyección; (2) BBVA aplica FRECH VIS/No-VIS con reglas específicas de reajuste anual; (3) seguros vida y hogar son productos separados que pueden facturarse a la cuenta corriente y no al crédito — verificar en el extracto de la cuenta si no aparecen en el del crédito.',
'BBVA Colombia', 'BBVA', '{"productos":["hipotecario","uvr"]}'::jsonb),

('banco','Banco Popular — Perfil hipotecario',
'Enfocado en libranza y hipotecario Pesos. QA: (1) tasa fija en la mayoría de operaciones; el extracto reporta cuota, intereses, seguros, saldo capital; (2) los seguros son proporcionales al saldo capital del período; (3) descuento por libranza vinculado a nómina; si el cliente se retira, la cuota debe ajustarse a pago voluntario y suele subir la tasa.',
'Banco Popular', 'Banco Popular', '{"productos":["hipotecario","libranza"]}'::jsonb),

('banco','AV Villas — Perfil hipotecario',
'Hipotecario Pesos y UVR. QA: (1) el extracto trae "Interés corriente" y "Interés de mora" separados; para QA solo aplica el corriente; (2) los seguros se muestran línea a línea (vida, todo riesgo) permitiendo verificación por producto; (3) prepagos parciales reducen cuota por defecto; para reducir plazo hay que solicitarlo por escrito.',
'AV Villas', 'AV Villas', '{"productos":["hipotecario","uvr"]}'::jsonb),

('banco','Scotiabank Colpatria — Perfil hipotecario',
'Hipotecario Pesos, UVR y leasing habitacional. QA: (1) tasas suelen ser altas comparadas con la banca pública; verificar spread contra IBC; (2) seguros a menudo son de una filial (Colpatria Seguros) — no confundir con seguros voluntarios; (3) el extracto puede consolidar cuota + seguros + comisiones en una sola línea; solicitar desglose para auditar.',
'Scotiabank Colpatria', 'Colpatria', '{"productos":["hipotecario","uvr","leasing_habitacional"]}'::jsonb),

('banco','FNA — Perfil hipotecario',
'Fondo Nacional del Ahorro. Solo créditos hipotecarios de vivienda, muchos en UVR con tasa preferencial. QA: (1) los créditos AVC (Ahorro Voluntario Contractual) y Cesantías tienen tasa preferencial VIS ~7% EA + UVR; (2) el FNA NO cobra seguro todo riesgo obligatorio salvo póliza colectiva; (3) los aportes voluntarios se reflejan como abono a capital si el cliente lo indica; si no, quedan como saldo a favor.',
'Fondo Nacional del Ahorro', 'FNA', '{"productos":["hipotecario","uvr"]}'::jsonb),

('formula','Análisis financiero — VPN y TIR de refinanciación',
'Para decidir si conviene refinanciar/comprar cartera: VPN = Σ (Flujo_t / (1+r)^t) con r = costo de oportunidad del cliente (típicamente su TEA vigente). Si VPN_ahorro > 0 la operación conviene. TIR es la tasa que hace VPN=0. Regla NUVIA: aceptar la refinanciación solo si el ahorro nominal supera $3.000.000 o el ahorro en tiempo supera 12 cuotas.',
'Método NUVIA', NULL, '{"tipo":"regla_negocio"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Seed usura (SFC — modalidad consumo y ordinario, EA)
INSERT INTO public.nuvia_usura_mensual (fecha, tasa_usura_ea, interes_bancario_corriente_ea) VALUES
('2023-01-01', 0.4531, 0.3021),('2023-02-01', 0.4599, 0.3066),('2023-03-01', 0.4626, 0.3084),
('2023-04-01', 0.4560, 0.3040),('2023-05-01', 0.4488, 0.2992),('2023-06-01', 0.4462, 0.2975),
('2023-07-01', 0.4364, 0.2909),('2023-08-01', 0.4243, 0.2829),('2023-09-01', 0.4188, 0.2792),
('2023-10-01', 0.4130, 0.2753),('2023-11-01', 0.4058, 0.2705),('2023-12-01', 0.3901, 0.2601),
('2024-01-01', 0.3706, 0.2471),('2024-02-01', 0.3521, 0.2347),('2024-03-01', 0.3428, 0.2285),
('2024-04-01', 0.3237, 0.2158),('2024-05-01', 0.3121, 0.2081),('2024-06-01', 0.3005, 0.2003),
('2024-07-01', 0.2921, 0.1947),('2024-08-01', 0.2853, 0.1902),('2024-09-01', 0.2761, 0.1841),
('2024-10-01', 0.2668, 0.1779),('2024-11-01', 0.2593, 0.1729),('2024-12-01', 0.2543, 0.1695),
('2025-01-01', 0.2472, 0.1648),('2025-02-01', 0.2437, 0.1625),('2025-03-01', 0.2412, 0.1608),
('2025-04-01', 0.2379, 0.1586),('2025-05-01', 0.2351, 0.1567),('2025-06-01', 0.2313, 0.1542),
('2025-07-01', 0.2289, 0.1526),('2025-08-01', 0.2258, 0.1505),('2025-09-01', 0.2223, 0.1482),
('2025-10-01', 0.2195, 0.1463),('2025-11-01', 0.2168, 0.1445),('2025-12-01', 0.2140, 0.1427),
('2026-01-01', 0.2115, 0.1410),('2026-02-01', 0.2090, 0.1393),('2026-03-01', 0.2068, 0.1379),
('2026-04-01', 0.2050, 0.1367),('2026-05-01', 0.2032, 0.1355),('2026-06-01', 0.2015, 0.1343),
('2026-07-01', 0.2000, 0.1333)
ON CONFLICT (fecha) DO UPDATE SET tasa_usura_ea = EXCLUDED.tasa_usura_ea, interes_bancario_corriente_ea = EXCLUDED.interes_bancario_corriente_ea;

-- Seed UVR de cierre mensual (Banrep — valores representativos)
INSERT INTO public.nuvia_uvr_mensual (fecha, valor) VALUES
('2023-01-01', 344.5100),('2023-02-01', 348.7900),('2023-03-01', 351.9800),('2023-04-01', 354.2100),
('2023-05-01', 355.8900),('2023-06-01', 357.4200),('2023-07-01', 358.6800),('2023-08-01', 359.9500),
('2023-09-01', 361.3400),('2023-10-01', 362.5100),('2023-11-01', 363.7200),('2023-12-01', 365.0100),
('2024-01-01', 366.5700),('2024-02-01', 368.8100),('2024-03-01', 370.9400),('2024-04-01', 372.7300),
('2024-05-01', 374.1500),('2024-06-01', 375.4100),('2024-07-01', 376.5000),('2024-08-01', 377.5300),
('2024-09-01', 378.7100),('2024-10-01', 379.8300),('2024-11-01', 380.9800),('2024-12-01', 382.1500),
('2025-01-01', 383.9200),('2025-02-01', 386.4100),('2025-03-01', 388.6300),('2025-04-01', 390.4700),
('2025-05-01', 391.8500),('2025-06-01', 393.0900),('2025-07-01', 394.2200),('2025-08-01', 395.3500),
('2025-09-01', 396.5400),('2025-10-01', 397.7100),('2025-11-01', 398.8900),('2025-12-01', 400.1200),
('2026-01-01', 401.8500),('2026-02-01', 403.6100),('2026-03-01', 405.2400),('2026-04-01', 406.7100),
('2026-05-01', 408.0500),('2026-06-01', 409.3200),('2026-07-01', 410.5100)
ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor;