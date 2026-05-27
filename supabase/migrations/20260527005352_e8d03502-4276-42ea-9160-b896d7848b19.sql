ALTER TABLE public.notificaciones_usuario REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones_usuario;