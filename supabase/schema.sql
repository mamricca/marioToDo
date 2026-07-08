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
  due_date date,
  parent_id uuid references public.tasks (id) on delete cascade,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_parent_id_idx on public.tasks (parent_id);

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

-- Resumen diario generado por IA. Solo la función serverless (con la
-- service_role key) escribe acá; el cliente solo lee su propia fila.
create table if not exists public.daily_summary (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null,
  generated_at timestamptz not null default now()
);

alter table public.daily_summary enable row level security;

create policy "Users can select their own summary"
  on public.daily_summary for select
  using (auth.uid() = user_id);

-- Modo Noticias — feeds RSS configurados a mano, ítems ingeridos por el cron
-- de /api/news, y el resumen diario generado por IA para ese modo.

create table if not exists public.feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  -- sigue apareciendo como chip (con su conteo), pero se excluye de
  -- "No leídas"/"Todas" salvo que se filtre esa fuente puntualmente.
  muted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds (id) on delete cascade,
  title text not null,
  link text not null,
  published_at timestamptz,
  read boolean not null default false,
  fetched_at timestamptz not null default now(),
  unique (feed_id, link)
);

create index if not exists feed_items_feed_id_idx on public.feed_items (feed_id);
create index if not exists feed_items_published_at_idx on public.feed_items (published_at desc);

alter table public.feeds enable row level security;
alter table public.feed_items enable row level security;

-- Un solo usuario autenticado; solo la función serverless (service_role)
-- inserta/borra feeds e ítems. El cliente solo lee, y puede actualizar el
-- estado "read" de un ítem (toggle leído/no leído).
create policy "Authenticated users can select feeds"
  on public.feeds for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can update feed muted state"
  on public.feeds for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can select feed items"
  on public.feed_items for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can update feed item read state"
  on public.feed_items for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Resumen diario del modo Noticias, mismo patrón que daily_summary.
create table if not exists public.news_summary (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null,
  generated_at timestamptz not null default now()
);

alter table public.news_summary enable row level security;

create policy "Users can select their own news summary"
  on public.news_summary for select
  using (auth.uid() = user_id);

insert into public.feeds (name, url) values
  ('la diaria', 'https://ladiaria.com.uy/feeds/articulos'),
  ('Jacobin LatAm', 'https://jacobinlat.com/feed/'),
  ('Politico', 'https://rss.politico.com/politics-news.xml'),
  ('AP News', 'https://feedx.net/rss/ap.xml'),
  ('Anthropic News', 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml'),
  ('Hacker News', 'https://hnrss.org/frontpage'),
  ('Smashing Magazine', 'https://www.smashingmagazine.com/feed/'),
  ('HLTV', 'https://www.hltv.org/rss/news'),
  ('Sheep Esports', 'https://www.sheepesports.com/en/lol'),
  ('ESPN', 'https://www.espn.com/espn/rss/news'),
  ('Soccernews', 'https://www.soccernews.com/feed')
on conflict (url) do nothing;
