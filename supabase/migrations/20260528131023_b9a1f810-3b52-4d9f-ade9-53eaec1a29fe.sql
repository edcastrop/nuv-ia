SELECT cron.schedule(
  'onboarding-recordatorios-diario',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--ef7f1bf2-d711-4a4f-b314-fa0bf64bdc47.lovable.app/api/public/hooks/onboarding-recordatorios',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);