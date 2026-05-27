DROP POLICY IF EXISTS "Notif select propio" ON public.notificaciones_usuario;
DROP POLICY IF EXISTS "Notif update propio" ON public.notificaciones_usuario;

CREATE POLICY "Notif select propio"
  ON public.notificaciones_usuario
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notif update propio"
  ON public.notificaciones_usuario
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());