-- Limpieza de expedientes maestros huérfanos generados por simulaciones exploratorias.
-- Definimos huérfano como: sin nombre real, sin extractos asociados, con más de 1h de antigüedad.
-- Estos registros son basura del flujo antiguo del Simulador (antes de moverlo a Herramientas en modo draft).

WITH huerfanos AS (
  SELECT m.id
    FROM public.expediente_maestro m
   WHERE (m.nombre_cliente IS NULL OR m.nombre_cliente = 'Sin nombre' OR btrim(m.nombre_cliente) = '')
     AND m.created_at < now() - interval '1 hour'
     AND NOT EXISTS (
       SELECT 1 FROM public.extractos_lecturas e WHERE e.expediente_id = m.id
     )
)
DELETE FROM public.expediente_maestro
 WHERE id IN (SELECT id FROM huerfanos);
