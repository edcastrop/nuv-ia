-- Permitir que el analista financiero asignado al expediente ejecute y audite
-- el envío a Contratación. La reasignación operativa actualiza licenciado_id,
-- mientras que asesor_id conserva al responsable comercial/creador.

DROP POLICY IF EXISTS "Envios visibles si expediente visible"
  ON public.envios_contratacion;

CREATE POLICY "Envios visibles si expediente visible"
  ON public.envios_contratacion
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expedientes e
      WHERE e.id = envios_contratacion.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR e.licenciado_id = auth.uid()
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'gerencia'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Envios insert por owner"
  ON public.envios_contratacion;
DROP POLICY IF EXISTS "Envios insert por owner o analista asignado"
  ON public.envios_contratacion;

CREATE POLICY "Envios insert por owner o analista asignado"
  ON public.envios_contratacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.expedientes e
      WHERE e.id = envios_contratacion.expediente_id
        AND (
          e.asesor_id = auth.uid()
          OR e.licenciado_id = auth.uid()
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'gerencia'::public.app_role)
        )
    )
  );
