-- Ejecutar en el SQL Editor de Supabase (proyecto ya existente):
-- permite silenciar una fuente del modo Noticias: sigue apareciendo como
-- chip (con su conteo real), pero sus ítems se excluyen de "No leídas"/
-- "Todas" salvo que se filtre esa fuente puntualmente.

alter table public.feeds add column if not exists muted boolean not null default false;

create policy "Authenticated users can update feed muted state"
  on public.feeds for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
