
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove previous version if any
DO $$ BEGIN
  PERFORM cron.unschedule('casos-alertas-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'casos-alertas-diario',
  '30 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sistema-nuvex.lovable.app/api/public/hooks/casos-alertas',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocHZsZ2lueWFxanp3amZsa3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODM3NjIsImV4cCI6MjA5NDk1OTc2Mn0.nAFNHw7h8fp4qQzsr8q8rpyMi1q4_WS0akycRtFmem4"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
