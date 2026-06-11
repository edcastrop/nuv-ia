ALTER TYPE public.bitacora_tipo ADD VALUE IF NOT EXISTS 'auditoria';
ALTER TYPE public.bitacora_tipo ADD VALUE IF NOT EXISTS 'seguimiento';
ALTER TYPE public.bitacora_tipo ADD VALUE IF NOT EXISTS 'alerta';