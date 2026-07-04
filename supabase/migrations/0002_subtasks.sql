-- Ejecutar en el SQL Editor de Supabase (proyecto ya existente):
-- agrega parent_id para sub-tareas ("> algo"), un solo nivel de profundidad.
-- on delete cascade: borrar la tarea madre borra sus sub-tareas.

alter table public.tasks add column if not exists parent_id uuid
  references public.tasks (id) on delete cascade;

create index if not exists tasks_parent_id_idx on public.tasks (parent_id);
