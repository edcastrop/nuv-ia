create table public.expediente_maestro (
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null,
  cedula_cliente text,
  nombre_cliente text not null default 'Sin nombre',
  cliente jsonb not null default '{}'::jsonb,
  cotitular jsonb not null default '{}'::jsonb,
  credito jsonb not null default '{}'::jsonb,
  fresh jsonb not null default '{}'::jsonb,
  asesor jsonb not null default '{}'::jsonb,
  licenciado jsonb not null default '{}'::jsonb,
  apoderado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_maestro_asesor on public.expediente_maestro (asesor_id);
create index idx_maestro_cedula on public.expediente_maestro (cedula_cliente);

alter table public.expediente_maestro enable row level security;

create policy "Maestro select por owner" on public.expediente_maestro
  for select using (auth.uid() = asesor_id or has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'gerencia'::app_role));
create policy "Maestro insert por owner" on public.expediente_maestro
  for insert with check (auth.uid() = asesor_id);
create policy "Maestro update por owner" on public.expediente_maestro
  for update using (auth.uid() = asesor_id or has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'gerencia'::app_role));
create policy "Maestro delete por owner" on public.expediente_maestro
  for delete using (auth.uid() = asesor_id or has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'gerencia'::app_role));

create trigger trg_maestro_updated
  before update on public.expediente_maestro
  for each row execute function public.update_updated_at_column();