ALTER PUBLICATION supabase_realtime ADD TABLE public.caso_alertas;
ALTER TABLE public.caso_alertas REPLICA IDENTITY FULL;