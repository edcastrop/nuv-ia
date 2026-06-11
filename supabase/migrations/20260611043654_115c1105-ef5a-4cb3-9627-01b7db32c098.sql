
-- Enums
DO $$ BEGIN
  CREATE TYPE public.honorarios_clasificacion AS ENUM ('estandar','intermedio','premium','corporativo','uvr_360');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.honorarios_estado AS ENUM ('borrador','ofertado','pendiente_aprobacion','aprobado','rechazado','contraofertado','cerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.honorarios_decision AS ENUM ('aprobado','rechazado','contraofertado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpers de autorización
CREATE OR REPLACE FUNCTION public.can_use_motor_honorarios(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role)
      OR public.has_role(_uid,'licenciado'::app_role)
      OR public.has_role(_uid,'asesor'::app_role)
      OR public.has_role(_uid,'director_financiero_qa'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_aprobar_honorarios(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'super_admin'::app_role)
      OR public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'gerencia'::app_role);
$$;

-- Tabla principal
CREATE TABLE public.honorarios_calculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid REFERENCES public.expedientes(id) ON DELETE SET NULL,
  cliente_nombre text NOT NULL,
  cedula text,
  banco text,
  tipo_credito text NOT NULL DEFAULT 'pesos',
  plazo_original_meses integer,
  saldo_capital numeric(16,2) DEFAULT 0,
  ahorro_intereses numeric(16,2) NOT NULL DEFAULT 0,
  ahorro_seguros numeric(16,2) NOT NULL DEFAULT 0,
  ahorro_total numeric(16,2) NOT NULL DEFAULT 0,
  clasificacion public.honorarios_clasificacion NOT NULL,
  porcentaje_aplicado numeric(5,2) NOT NULL,
  honorario_teorico numeric(16,2) NOT NULL,
  honorario_topado numeric(16,2) NOT NULL,
  alerta_tope boolean NOT NULL DEFAULT false,
  honorario_ofertado numeric(16,2),
  descuento_aplicado_pct numeric(5,2) DEFAULT 0,
  rentabilidad_pct numeric(5,2),
  estado public.honorarios_estado NOT NULL DEFAULT 'borrador',
  notas text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.honorarios_calculos TO authenticated;
GRANT ALL ON public.honorarios_calculos TO service_role;
ALTER TABLE public.honorarios_calculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_hon_select" ON public.honorarios_calculos FOR SELECT TO authenticated
USING (public.can_aprobar_honorarios(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "motor_hon_insert" ON public.honorarios_calculos FOR INSERT TO authenticated
WITH CHECK (public.can_use_motor_honorarios(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "motor_hon_update" ON public.honorarios_calculos FOR UPDATE TO authenticated
USING (public.can_aprobar_honorarios(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.can_aprobar_honorarios(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_honorarios_calculos_updated
  BEFORE UPDATE ON public.honorarios_calculos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aprobaciones
CREATE TABLE public.honorarios_aprobaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id uuid NOT NULL REFERENCES public.honorarios_calculos(id) ON DELETE CASCADE,
  solicitado_por uuid NOT NULL DEFAULT auth.uid(),
  aprobado_por uuid,
  decision public.honorarios_decision,
  honorario_recomendado numeric(16,2) NOT NULL,
  honorario_solicitado numeric(16,2) NOT NULL,
  honorario_contraoferta numeric(16,2),
  motivo_solicitud text NOT NULL,
  comentarios_aprobador text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decidido_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.honorarios_aprobaciones TO authenticated;
GRANT ALL ON public.honorarios_aprobaciones TO service_role;
ALTER TABLE public.honorarios_aprobaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_aprob_select" ON public.honorarios_aprobaciones FOR SELECT TO authenticated
USING (public.can_aprobar_honorarios(auth.uid()) OR solicitado_por = auth.uid());

CREATE POLICY "motor_aprob_insert" ON public.honorarios_aprobaciones FOR INSERT TO authenticated
WITH CHECK (public.can_use_motor_honorarios(auth.uid()) AND solicitado_por = auth.uid());

CREATE POLICY "motor_aprob_update" ON public.honorarios_aprobaciones FOR UPDATE TO authenticated
USING (public.can_aprobar_honorarios(auth.uid()))
WITH CHECK (public.can_aprobar_honorarios(auth.uid()));

-- Auditoría inmutable
CREATE TABLE public.honorarios_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id uuid REFERENCES public.honorarios_calculos(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  accion text NOT NULL,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.honorarios_auditoria TO authenticated;
GRANT ALL ON public.honorarios_auditoria TO service_role;
ALTER TABLE public.honorarios_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_audit_select" ON public.honorarios_auditoria FOR SELECT TO authenticated
USING (
  public.can_aprobar_honorarios(auth.uid())
  OR EXISTS (SELECT 1 FROM public.honorarios_calculos c WHERE c.id = calculo_id AND c.created_by = auth.uid())
);

CREATE POLICY "motor_audit_insert" ON public.honorarios_auditoria FOR INSERT TO authenticated
WITH CHECK (true);

-- Trigger de auditoría automática
CREATE OR REPLACE FUNCTION public.trg_honorarios_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.honorarios_auditoria(calculo_id, user_id, accion, valor_nuevo)
    VALUES (NEW.id, auth.uid(), 'creado', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado
       OR NEW.honorario_ofertado IS DISTINCT FROM OLD.honorario_ofertado
       OR NEW.descuento_aplicado_pct IS DISTINCT FROM OLD.descuento_aplicado_pct THEN
      INSERT INTO public.honorarios_auditoria(calculo_id, user_id, accion, valor_anterior, valor_nuevo)
      VALUES (NEW.id, auth.uid(), 'actualizado',
        jsonb_build_object('estado', OLD.estado, 'honorario_ofertado', OLD.honorario_ofertado, 'descuento_aplicado_pct', OLD.descuento_aplicado_pct),
        jsonb_build_object('estado', NEW.estado, 'honorario_ofertado', NEW.honorario_ofertado, 'descuento_aplicado_pct', NEW.descuento_aplicado_pct));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_honorarios_calculos_audit
  AFTER INSERT OR UPDATE ON public.honorarios_calculos
  FOR EACH ROW EXECUTE FUNCTION public.trg_honorarios_audit();

CREATE INDEX idx_honorarios_calculos_created_by ON public.honorarios_calculos(created_by);
CREATE INDEX idx_honorarios_calculos_estado ON public.honorarios_calculos(estado);
CREATE INDEX idx_honorarios_calculos_expediente ON public.honorarios_calculos(expediente_id);
CREATE INDEX idx_honorarios_aprob_calculo ON public.honorarios_aprobaciones(calculo_id);
