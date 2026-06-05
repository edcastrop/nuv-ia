
-- ========== Tabla maestra de productos bancarios ==========
CREATE TABLE public.productos_bancarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco text NOT NULL,
  tipo_producto text NOT NULL CHECK (tipo_producto IN ('credito_hipotecario','leasing_habitacional')),
  modalidad text NOT NULL CHECK (modalidad IN ('pesos','uvr')),
  submodalidad_uvr text CHECK (submodalidad_uvr IN ('baja','media','alta')),
  cobertura boolean NOT NULL DEFAULT false,
  nombre_comercial text NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.productos_bancarios TO authenticated, anon;
GRANT ALL ON public.productos_bancarios TO service_role;

ALTER TABLE public.productos_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_bancarios_select_all"
  ON public.productos_bancarios FOR SELECT
  USING (true);

CREATE POLICY "productos_bancarios_admin_write"
  ON public.productos_bancarios FOR ALL
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_productos_bancarios_updated
  BEFORE UPDATE ON public.productos_bancarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_productos_bancarios_banco ON public.productos_bancarios(banco, activo);

-- ========== Seed: Bancolombia (8) ==========
INSERT INTO public.productos_bancarios (banco, tipo_producto, modalidad, submodalidad_uvr, cobertura, nombre_comercial, codigo, orden) VALUES
('Bancolombia','credito_hipotecario','pesos',NULL,true,'Crédito hipotecario en pesos con beneficio de cobertura','BCO_CH_PESOS_COB',1),
('Bancolombia','credito_hipotecario','pesos',NULL,false,'Crédito hipotecario en pesos sin beneficio de cobertura','BCO_CH_PESOS_SIN',2),
('Bancolombia','credito_hipotecario','uvr',NULL,true,'Crédito hipotecario en UVR con beneficio de cobertura','BCO_CH_UVR_COB',3),
('Bancolombia','credito_hipotecario','uvr',NULL,false,'Crédito hipotecario en UVR sin beneficio de cobertura','BCO_CH_UVR_SIN',4),
('Bancolombia','leasing_habitacional','pesos',NULL,true,'Leasing habitacional en pesos con beneficio de cobertura','BCO_LH_PESOS_COB',5),
('Bancolombia','leasing_habitacional','pesos',NULL,false,'Leasing habitacional en pesos sin beneficio de cobertura','BCO_LH_PESOS_SIN',6),
('Bancolombia','leasing_habitacional','uvr',NULL,true,'Leasing habitacional en UVR con beneficio de cobertura','BCO_LH_UVR_COB',7),
('Bancolombia','leasing_habitacional','uvr',NULL,false,'Leasing habitacional en UVR sin beneficio de cobertura','BCO_LH_UVR_SIN',8);

-- ========== Seed: Davivienda (16) ==========
INSERT INTO public.productos_bancarios (banco, tipo_producto, modalidad, submodalidad_uvr, cobertura, nombre_comercial, codigo, orden) VALUES
('Davivienda','credito_hipotecario','pesos',NULL,true,'Crédito hipotecario en pesos cuota fija con beneficio de cobertura','DAV_CH_PESOS_COB',1),
('Davivienda','credito_hipotecario','pesos',NULL,false,'Crédito hipotecario en pesos cuota fija sin beneficio de cobertura','DAV_CH_PESOS_SIN',2),
('Davivienda','credito_hipotecario','uvr','baja',true,'Crédito hipotecario en UVR Baja con beneficio de cobertura','DAV_CH_UVR_BAJA_COB',3),
('Davivienda','credito_hipotecario','uvr','baja',false,'Crédito hipotecario en UVR Baja sin beneficio de cobertura','DAV_CH_UVR_BAJA_SIN',4),
('Davivienda','credito_hipotecario','uvr','media',true,'Crédito hipotecario en UVR Media con beneficio de cobertura','DAV_CH_UVR_MEDIA_COB',5),
('Davivienda','credito_hipotecario','uvr','media',false,'Crédito hipotecario en UVR Media sin beneficio de cobertura','DAV_CH_UVR_MEDIA_SIN',6),
('Davivienda','credito_hipotecario','uvr','alta',true,'Crédito hipotecario en UVR Alta con beneficio de cobertura','DAV_CH_UVR_ALTA_COB',7),
('Davivienda','credito_hipotecario','uvr','alta',false,'Crédito hipotecario en UVR Alta sin beneficio de cobertura','DAV_CH_UVR_ALTA_SIN',8),
('Davivienda','leasing_habitacional','pesos',NULL,true,'Contrato leasing en Pesos con beneficio de cobertura','DAV_LH_PESOS_COB',9),
('Davivienda','leasing_habitacional','pesos',NULL,false,'Contrato leasing en Pesos sin beneficio de cobertura','DAV_LH_PESOS_SIN',10),
('Davivienda','leasing_habitacional','uvr','baja',true,'Contrato leasing en UVR Baja con beneficio de cobertura','DAV_LH_UVR_BAJA_COB',11),
('Davivienda','leasing_habitacional','uvr','baja',false,'Contrato leasing en UVR Baja sin beneficio de cobertura','DAV_LH_UVR_BAJA_SIN',12),
('Davivienda','leasing_habitacional','uvr','media',true,'Contrato leasing en UVR Media con beneficio de cobertura','DAV_LH_UVR_MEDIA_COB',13),
('Davivienda','leasing_habitacional','uvr','media',false,'Contrato leasing en UVR Media sin beneficio de cobertura','DAV_LH_UVR_MEDIA_SIN',14),
('Davivienda','leasing_habitacional','uvr','alta',true,'Contrato leasing en UVR Alta con beneficio de cobertura','DAV_LH_UVR_ALTA_COB',15),
('Davivienda','leasing_habitacional','uvr','alta',false,'Contrato leasing en UVR Alta sin beneficio de cobertura','DAV_LH_UVR_ALTA_SIN',16);

-- ========== Seed: Banco de Bogotá (8) ==========
INSERT INTO public.productos_bancarios (banco, tipo_producto, modalidad, submodalidad_uvr, cobertura, nombre_comercial, codigo, orden) VALUES
('Banco de Bogotá','credito_hipotecario','pesos',NULL,true,'Crédito de vivienda en pesos con beneficio de cobertura','BOG_CH_PESOS_COB',1),
('Banco de Bogotá','credito_hipotecario','pesos',NULL,false,'Crédito de vivienda en pesos sin beneficio de cobertura','BOG_CH_PESOS_SIN',2),
('Banco de Bogotá','credito_hipotecario','uvr',NULL,true,'Crédito de vivienda en UVR con beneficio de cobertura','BOG_CH_UVR_COB',3),
('Banco de Bogotá','credito_hipotecario','uvr',NULL,false,'Crédito de vivienda en UVR sin beneficio de cobertura','BOG_CH_UVR_SIN',4),
('Banco de Bogotá','leasing_habitacional','pesos',NULL,true,'Crédito Leasing Habitacional Familiar en pesos con beneficio de cobertura','BOG_LH_PESOS_COB',5),
('Banco de Bogotá','leasing_habitacional','pesos',NULL,false,'Crédito Leasing Habitacional Familiar en pesos sin beneficio de cobertura','BOG_LH_PESOS_SIN',6),
('Banco de Bogotá','leasing_habitacional','uvr',NULL,true,'Crédito Leasing Habitacional Familiar en UVR con beneficio de cobertura','BOG_LH_UVR_COB',7),
('Banco de Bogotá','leasing_habitacional','uvr',NULL,false,'Crédito Leasing Habitacional Familiar en UVR sin beneficio de cobertura','BOG_LH_UVR_SIN',8);

-- ========== Seed: Caja Social (4) ==========
INSERT INTO public.productos_bancarios (banco, tipo_producto, modalidad, submodalidad_uvr, cobertura, nombre_comercial, codigo, orden) VALUES
('Caja Social','credito_hipotecario','pesos',NULL,true,'Crédito de Vivienda cuota fija en pesos con beneficio de cobertura','CAJ_CH_PESOS_COB',1),
('Caja Social','credito_hipotecario','pesos',NULL,false,'Crédito de Vivienda cuota fija en pesos sin beneficio de cobertura','CAJ_CH_PESOS_SIN',2),
('Caja Social','credito_hipotecario','uvr',NULL,true,'Crédito de Vivienda cuota fija en UVR con beneficio de cobertura','CAJ_CH_UVR_COB',3),
('Caja Social','credito_hipotecario','uvr',NULL,false,'Crédito de Vivienda cuota fija en UVR sin beneficio de cobertura','CAJ_CH_UVR_SIN',4);

-- ========== Seed genérico: resto de bancos (8 cada uno) ==========
DO $$
DECLARE
  v_bancos text[] := ARRAY['FNA','Davibank','La Hipotecaria','AV Villas','Banco de Occidente','Caja Honor','Credifamilia','Bancoomeva','Banco Popular'];
  v_banco text;
  v_prefix text;
BEGIN
  FOREACH v_banco IN ARRAY v_bancos LOOP
    v_prefix := upper(regexp_replace(translate(v_banco, 'áéíóúÁÉÍÓÚ ', 'aeiouAEIOU_'), '[^A-Z_]', '', 'g'));
    v_prefix := substring(v_prefix from 1 for 6);
    INSERT INTO public.productos_bancarios (banco, tipo_producto, modalidad, submodalidad_uvr, cobertura, nombre_comercial, codigo, orden) VALUES
      (v_banco,'credito_hipotecario','pesos',NULL,true ,'Crédito hipotecario en pesos con beneficio de cobertura — '||v_banco, v_prefix||'_CH_PESOS_COB',1),
      (v_banco,'credito_hipotecario','pesos',NULL,false,'Crédito hipotecario en pesos sin beneficio de cobertura — '||v_banco, v_prefix||'_CH_PESOS_SIN',2),
      (v_banco,'credito_hipotecario','uvr'  ,NULL,true ,'Crédito hipotecario en UVR con beneficio de cobertura — '||v_banco,   v_prefix||'_CH_UVR_COB',3),
      (v_banco,'credito_hipotecario','uvr'  ,NULL,false,'Crédito hipotecario en UVR sin beneficio de cobertura — '||v_banco,   v_prefix||'_CH_UVR_SIN',4),
      (v_banco,'leasing_habitacional','pesos',NULL,true ,'Leasing habitacional en pesos con beneficio de cobertura — '||v_banco, v_prefix||'_LH_PESOS_COB',5),
      (v_banco,'leasing_habitacional','pesos',NULL,false,'Leasing habitacional en pesos sin beneficio de cobertura — '||v_banco, v_prefix||'_LH_PESOS_SIN',6),
      (v_banco,'leasing_habitacional','uvr'  ,NULL,true ,'Leasing habitacional en UVR con beneficio de cobertura — '||v_banco,   v_prefix||'_LH_UVR_COB',7),
      (v_banco,'leasing_habitacional','uvr'  ,NULL,false,'Leasing habitacional en UVR sin beneficio de cobertura — '||v_banco,   v_prefix||'_LH_UVR_SIN',8);
  END LOOP;
END $$;

-- ========== Referencia opcional en expedientes ==========
ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS producto_bancario_id uuid REFERENCES public.productos_bancarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_producto_bancario ON public.expedientes(producto_bancario_id);
