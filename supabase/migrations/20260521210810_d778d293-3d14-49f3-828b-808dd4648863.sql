-- Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencia';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'licenciado';