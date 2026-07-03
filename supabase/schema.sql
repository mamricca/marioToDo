-- Ejecutar en el SQL Editor de tu proyecto de Supabase.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw text not null,
  text text not null,
  priority text,
  projects text[] not null default '{}',
  contexts text[] not null default '{}',
  urls text[] not null default '{}',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

alter table public.tasks enable row level security;

create policy "Users can select their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);
