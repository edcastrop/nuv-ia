-- Limpieza legacy NUVEX GPT: eliminar tablas KB legacy y log sin uso.
-- Conservamos gpt_tickets, gpt_conversaciones, gpt_mensajes (usadas por chat flotante y escalamiento).
DROP TABLE IF EXISTS public.gpt_kb_articulos CASCADE;
DROP TABLE IF EXISTS public.gpt_kb_categorias CASCADE;
DROP TABLE IF EXISTS public.gpt_consultas_log CASCADE;