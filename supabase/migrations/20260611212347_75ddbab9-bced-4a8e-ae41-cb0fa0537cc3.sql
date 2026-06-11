
-- =====================================================================
-- FASE 7.6.1 — NUVIA Operating Model: fundación de datos
-- =====================================================================

-- ---------- 1. CLIENTE MAESTRO ----------
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT NOT NULL UNIQUE,
  nombre_completo TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  ciudad TEXT,
  fecha_primer_caso TIMESTAMPTZ,
  fecha_ultimo_caso TIMESTAMPTZ,
  total_expedientes INT NOT NULL DEFAULT 0,
  total_ahorro_generado NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_honorarios_pagados NUMERIC(18,2) NOT NULL DEFAULT 0,
  nps_ultimo INT,
  es_promotor BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_select_authenticated" ON public.clientes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_write_admin" ON public.clientes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerencia'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerencia'));
CREATE INDEX idx_clientes_cedula ON public.clientes(cedula);
CREATE INDEX idx_clientes_promotor ON public.clientes(es_promotor) WHERE es_promotor = true;

-- ---------- 2. CATÁLOGO DE ETAPAS ----------
CREATE TABLE public.etapa_definicion (
  id TEXT PRIMARY KEY,
  numero INT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  objetivo TEXT,
  responsable_default TEXT,
  sla_dias_habiles INT,
  ciclo TEXT NOT NULL,
  orden_visual INT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.etapa_definicion TO authenticated;
GRANT ALL ON public.etapa_definicion TO service_role;
ALTER TABLE public.etapa_definicion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapa_def_read_all" ON public.etapa_definicion
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "etapa_def_write_admin" ON public.etapa_definicion
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.etapa_subestado_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id TEXT NOT NULL REFERENCES public.etapa_definicion(id) ON DELETE CASCADE,
  subestado TEXT NOT NULL,
  descripcion TEXT,
  es_inicial BOOLEAN NOT NULL DEFAULT false,
  es_final BOOLEAN NOT NULL DEFAULT false,
  es_bloqueante BOOLEAN NOT NULL DEFAULT false,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(etapa_id, subestado)
);
GRANT SELECT ON public.etapa_subestado_catalogo TO authenticated;
GRANT ALL ON public.etapa_subestado_catalogo TO service_role;
ALTER TABLE public.etapa_subestado_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapa_sub_read_all" ON public.etapa_subestado_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "etapa_sub_write_admin" ON public.etapa_subestado_catalogo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- ---------- 3. COLUMNAS ADITIVAS EN EXPEDIENTES ----------
ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS subestado TEXT,
  ADD COLUMN IF NOT EXISTS responsable_primario_id UUID,
  ADD COLUMN IF NOT EXISTS sla_vence_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_cliente_id ON public.expedientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_responsable ON public.expedientes(responsable_primario_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_sla ON public.expedientes(sla_vence_at) WHERE sla_vence_at IS NOT NULL;

-- ---------- 4. VALIDACIÓN OPERATIVA (E9) ----------
CREATE TABLE public.validacion_operativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  validado_por UUID,
  resultado TEXT NOT NULL CHECK (resultado IN ('pendiente','aprobado','rechazado','observaciones')),
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo_rechazo TEXT,
  etapa_destino_si_rechazo TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.validacion_operativa TO authenticated;
GRANT ALL ON public.validacion_operativa TO service_role;
ALTER TABLE public.validacion_operativa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "valop_read_authenticated" ON public.validacion_operativa
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "valop_write_authenticated" ON public.validacion_operativa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_valop_expediente ON public.validacion_operativa(expediente_id);

-- ---------- 5. SLA DINÁMICO POR BANCO ----------
CREATE TABLE public.banco_sla_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco TEXT NOT NULL,
  fecha DATE NOT NULL,
  casos_abiertos INT NOT NULL DEFAULT 0,
  casos_vencidos INT NOT NULL DEFAULT 0,
  tiempo_promedio_dias NUMERIC(10,2),
  tiempo_max_dias INT,
  tiempo_min_dias INT,
  tasa_requerimientos NUMERIC(5,2),
  tasa_favorable NUMERIC(5,2),
  muestra INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(banco, fecha)
);
GRANT SELECT ON public.banco_sla_metricas TO authenticated;
GRANT ALL ON public.banco_sla_metricas TO service_role;
ALTER TABLE public.banco_sla_metricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_sla_read_exec" ON public.banco_sla_metricas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerencia') OR
    public.has_role(auth.uid(), 'director_financiero_qa') OR
    public.has_role(auth.uid(), 'director_juridico')
  );
CREATE INDEX idx_banco_sla_fecha ON public.banco_sla_metricas(fecha DESC);
CREATE INDEX idx_banco_sla_banco ON public.banco_sla_metricas(banco);

CREATE TABLE public.banco_requerimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  banco TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descripcion TEXT,
  etapa_destino TEXT,
  solicitado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_at TIMESTAMPTZ,
  dias_resolucion NUMERIC(10,2),
  resuelto_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_requerimientos TO authenticated;
GRANT ALL ON public.banco_requerimientos TO service_role;
ALTER TABLE public.banco_requerimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_req_read_auth" ON public.banco_requerimientos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "banco_req_write_auth" ON public.banco_requerimientos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_banco_req_expediente ON public.banco_requerimientos(expediente_id);
CREATE INDEX idx_banco_req_banco ON public.banco_requerimientos(banco);

-- ---------- 6. CONCILIACIÓN DE PAGOS ----------
CREATE TABLE public.pago_conciliacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_cobro_id UUID,
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  monto_reportado NUMERIC(18,2),
  monto_conciliado NUMERIC(18,2),
  diferencia NUMERIC(18,2),
  reportado_at TIMESTAMPTZ,
  conciliado_at TIMESTAMPTZ,
  tesoreria_user_id UUID,
  estado TEXT NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando','reportado','en_conciliacion','pagado','cerrado','parcial','disputado')),
  soporte_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pago_conciliacion TO authenticated;
GRANT ALL ON public.pago_conciliacion TO service_role;
ALTER TABLE public.pago_conciliacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pago_conc_read_auth" ON public.pago_conciliacion
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pago_conc_write_auth" ON public.pago_conciliacion
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_pago_conc_expediente ON public.pago_conciliacion(expediente_id);
CREATE INDEX idx_pago_conc_estado ON public.pago_conciliacion(estado);

-- ---------- 7. TESTIMONIOS ----------
CREATE TABLE public.testimonios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('video','audio','texto','caso_exito')),
  url TEXT,
  contenido_texto TEXT,
  consentimiento_uso BOOLEAN NOT NULL DEFAULT false,
  publicable BOOLEAN NOT NULL DEFAULT false,
  nps_asociado INT,
  estado TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('no_aplicable','solicitado','agendado','grabado','aprobado_cliente','publicable','archivado')),
  capturado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonios TO authenticated;
GRANT ALL ON public.testimonios TO service_role;
ALTER TABLE public.testimonios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "testimonios_read_auth" ON public.testimonios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "testimonios_write_auth" ON public.testimonios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_testimonios_cliente ON public.testimonios(cliente_id);

-- ---------- 8. REFERIDOS ----------
CREATE TABLE public.casos_referidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_referente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  caso_origen_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  caso_referido_id UUID REFERENCES public.expedientes(id) ON DELETE SET NULL,
  link_unico TEXT UNIQUE,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_contacto TIMESTAMPTZ,
  fecha_conversion TIMESTAMPTZ,
  convertido BOOLEAN NOT NULL DEFAULT false,
  valor_generado NUMERIC(18,2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'solicitud_enviada' CHECK (estado IN ('solicitud_enviada','link_generado','recibido','contactado','convertido','sin_respuesta')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.casos_referidos TO authenticated;
GRANT ALL ON public.casos_referidos TO service_role;
ALTER TABLE public.casos_referidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referidos_read_auth" ON public.casos_referidos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "referidos_write_auth" ON public.casos_referidos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_referidos_referente ON public.casos_referidos(cliente_referente_id);

-- ---------- 9. PROMOTORES ----------
CREATE TABLE public.clientes_promotores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL DEFAULT 'activo' CHECK (nivel IN ('activo','embajador','inactivo','reactivado')),
  nps_ultimo INT,
  testimonios_count INT NOT NULL DEFAULT 0,
  referidos_count INT NOT NULL DEFAULT 0,
  casos_originados INT NOT NULL DEFAULT 0,
  valor_generado NUMERIC(18,2) NOT NULL DEFAULT 0,
  fecha_alta TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_ultima_actividad TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id)
);
GRANT SELECT ON public.clientes_promotores TO authenticated;
GRANT ALL ON public.clientes_promotores TO service_role;
ALTER TABLE public.clientes_promotores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotores_read_exec" ON public.clientes_promotores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerencia')
  );

-- ---------- 10. EVENT BUS ----------
CREATE TABLE public.caso_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo_evento TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  origen TEXT,
  idempotency_key TEXT UNIQUE,
  procesado BOOLEAN NOT NULL DEFAULT false,
  procesado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.caso_eventos TO authenticated;
GRANT ALL ON public.caso_eventos TO service_role;
ALTER TABLE public.caso_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_read_auth" ON public.caso_eventos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "eventos_insert_auth" ON public.caso_eventos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_eventos_expediente ON public.caso_eventos(expediente_id);
CREATE INDEX idx_eventos_tipo ON public.caso_eventos(tipo_evento);
CREATE INDEX idx_eventos_no_procesado ON public.caso_eventos(procesado) WHERE procesado = false;

-- ---------- 11. TRIGGERS updated_at ----------
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_etapa_def_updated BEFORE UPDATE ON public.etapa_definicion
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_valop_updated BEFORE UPDATE ON public.validacion_operativa
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_pago_conc_updated BEFORE UPDATE ON public.pago_conciliacion
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_testimonios_updated BEFORE UPDATE ON public.testimonios
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_referidos_updated BEFORE UPDATE ON public.casos_referidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tg_promotores_updated BEFORE UPDATE ON public.clientes_promotores
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
