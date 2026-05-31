-- Extender tabla expediente_checklist_envios para trazabilidad real con Resend
ALTER TABLE public.expediente_checklist_envios
  ADD COLUMN IF NOT EXISTS destinatarios text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_emails text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documentos_solicitados jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estado_envio text NOT NULL DEFAULT 'enviado',
  ADD COLUMN IF NOT EXISTS proveedor_message_id text,
  ADD COLUMN IF NOT EXISTS error text;

-- Permitir que enviado_a_email sea nullable (se reemplaza por destinatarios[])
ALTER TABLE public.expediente_checklist_envios
  ALTER COLUMN enviado_a_email DROP NOT NULL,
  ALTER COLUMN asunto DROP NOT NULL,
  ALTER COLUMN cuerpo DROP NOT NULL;

GRANT SELECT, INSERT ON public.expediente_checklist_envios TO authenticated;
GRANT ALL ON public.expediente_checklist_envios TO service_role;