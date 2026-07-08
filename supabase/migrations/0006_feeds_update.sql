-- Ejecutar en el SQL Editor de Supabase (proyecto ya existente):
-- ajusta la lista de feeds del modo Noticias — saca las que no andaban
-- bien o no interesaban, suma cuatro nuevas. Borrar una fuente de
-- `feeds` cascadea a sus `feed_items` (on delete cascade), así que sus
-- ítems viejos también desaparecen.

delete from public.feeds where url in (
  'https://jacobin.com/feed',
  'https://css-tricks.com/feed/',
  'https://simonwillison.net/atom/everything/',
  'https://web.dev/feed.xml'
);

insert into public.feeds (name, url) values
  ('Soccernews', 'https://www.soccernews.com/feed'),
  ('Politico', 'https://rss.politico.com/politics-news.xml'),
  ('AP News', 'https://feedx.net/rss/ap.xml'),
  ('Jacobin LatAm', 'https://jacobinlat.com/feed/')
on conflict (url) do nothing;
