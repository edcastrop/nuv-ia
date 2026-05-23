CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('cartera-recordatorios-diarios')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cartera-recordatorios-diarios');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cartera-recordatorios-diarios',
  '0 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--ef7f1bf2-d711-4a4f-b314-fa0bf64bdc47.lovable.app/api/public/hooks/cartera-recordatorios',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocHZsZ2lueWFxanp3amZsa3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODM3NjIsImV4cCI6MjA5NDk1OTc2Mn0.nAFNHw7h8fp4qQzsr8q8rpyMi1q4_WS0akycRtFmem4"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);