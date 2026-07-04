-- Ejecutar en el SQL Editor de Supabase (proyecto ya existente):
-- tabla para cachear el resumen diario generado por IA. Solo la
-- función serverless (con la service_role key) escribe acá; el
-- cliente solo lee su propia fila.

create table if not exists public.daily_summary (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null,
  generated_at timestamptz not null default now()
);

alter table public.daily_summary enable row level security;

create policy "Users can select their own summary"
  on public.daily_summary for select
  using (auth.uid() = user_id);
