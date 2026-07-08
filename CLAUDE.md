# todos — app personal de tareas (PWA)

App de una sola lista de tareas, un solo usuario, sintaxis estilo
todo.txt, pensada para vivir 24/7 en Android y PC con hosting gratis.

## Stack

- Vite + React + TypeScript, sin librerías de estado ni UI kit.
- CSS plano (`src/App.css`), tema **editorial dark**: fondo negro
  cálido, acento rojo tinta usado con moderación (prioridad A, foco),
  tipografías Fraunces (titular) + Instrument Sans (UI) + IBM Plex Mono
  (toda la sintaxis todo.txt).
- Datos: Supabase (Postgres + auth por email/contraseña, RLS por
  `user_id`).
- Deploy: Vercel (free tier), conectado a GitHub para deploy
  automático.

## Estado actual: deployado, con sub-tareas, montos, resumen IA y modo Noticias

**URL de producción: https://mario-to-do.vercel.app**
**Repo: https://github.com/mamricca/marioToDo** (rama `main`, cada
push dispara un deploy automático en Vercel).

### Setup desde cero

1. `npm install`.
2. Crear proyecto gratis en https://supabase.com.
3. Correr `supabase/schema.sql` en el SQL Editor (crea la tabla
   `tasks` con RLS por `auth.uid() = user_id`). Si el proyecto ya
   existe de antes, correr también los archivos en
   `supabase/migrations/` en orden (agregan columnas nuevas sin tocar
   datos existentes).
4. `cp .env.example .env` y completar `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
5. Setear la contraseña del único usuario con `scripts/set-password.mjs`
   (ver "Login" abajo) — no usa magic link, no hace falta configurar
   Redirect URLs.
6. (Opcional, para el resumen con IA) crear una API key gratis en
   Google AI Studio y setear en Vercel `GEMINI_API_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` — ver sección "Resumen
   diario con IA" más abajo. Sin esto la app funciona igual, solo usa
   el titular calculado localmente. Las mismas tres variables alimentan
   también el modo Noticias (sección aparte más abajo).
7. Los feeds RSS del modo Noticias se seedean solos al correr
   `supabase/migrations/0004_feeds.sql` (paso 3). Para agregar/sacar
   feeds después, editar la tabla `feeds` a mano desde el SQL Editor —
   no hay UI para esto, es a propósito (un solo usuario).
8. `npm run dev`.

### Qué hace

- **Login por email + contraseña** (`src/components/Login.tsx` +
  `src/hooks/useAuth.ts`), no magic link (ver por qué en "Decisiones").
- **Captura rápida** (`src/components/CaptureInput.tsx`) con
  **resaltado de sintaxis en vivo** mientras se escribe: prioridad,
  `+proyecto`, `@contexto`, URLs y fechas relativas se colorean en
  tiempo real. Implementado con la técnica de overlay: un input real
  con texto transparente encima de un `div` con los mismos spans
  coloreados debajo (`capture-backdrop` + `capture-input` en
  `App.css`), sincronizados en scroll.
- **Autocompletado de `+proyecto`/`@contexto`**: al escribir `+` o `@`
  aparece un dropdown con las categorías/contextos ya usados,
  filtrado por lo que sigue escribiendo. Flechas para navegar,
  Enter/Tab para aceptar, click también funciona.
- **Fechas en español** (`parser.ts`, función `extractDueDate`,
  lista `DATE_MATCHERS`): reconoce, en cualquier parte del texto, y
  calcula una fecha concreta (ISO `YYYY-MM-DD`, guardada en
  `due_date`):
  - Relativas: `hoy`, `mañana`, `pasado mañana`, `en 3 días`,
    `en una semana` / `en 2 semanas`.
  - Días de la semana: `el sábado`, `el próximo sábado`.
  - Absolutas: `4 de julio`, `15/8` (día/mes, no mes/día),
    `15/8/2027`, `2026-07-15`.
  - `el <día>` sin "próximo" → la próxima ocurrencia de ese día,
    contando hoy mismo si hoy es ese día.
  - `el próximo <día>` → salta una semana completa además de eso
    (si hoy es sábado, "el próximo sábado" es el de la semana que
    viene, no hoy).
  - Fechas absolutas sin año (`4 de julio`, `15/8`) asumen el año
    actual, o el que viene si esa fecha ya pasó este año.
  - La fecha se recalcula cada vez que se re-parsea la línea (por
    ejemplo al editar la tarea) usando el momento actual — si el
    texto sigue diciendo "el sábado" semanas después, va a apuntar al
    sábado más próximo desde ese momento, no al original. Es una
    consecuencia de que el texto crudo es la fuente de verdad (mismo
    principio que prioridad/categorías/contextos), no un bug.
  - En la lista, la fecha se muestra como badge corto ("sáb 4 jul")
    en la meta-línea de la tarea; si ya pasó y la tarea sigue activa,
    se resalta con el color de acento (mismo tratamiento que
    prioridad A, para no introducir un color de "urgencia" nuevo).
- **Tags/URLs fuera del texto**: `stripTags` limpia `+proyecto`,
  `@contexto`, URLs y la frase de fecha del cuerpo visible de la
  tarea; se muestran aparte, en una línea de metadatos debajo del
  texto (`task-meta`), no inline en la oración. El `raw`/`text`
  completo se preserva igual para poder editar sin perder nada.
- **Montos resaltados**: `$45000`, `$45.000`, `$1.234,56` se colorean
  en dorado apagado (`--money`), pero a diferencia de tags/fecha/URL
  **no se sacan del cuerpo del texto** — quedan inline, como una
  palabra más resaltada, no como badge aparte.
- **Sub-tareas con `>`** (un solo nivel de profundidad): escribir
  `> comprar pasajes` después de crear una tarea la agrega como
  sub-tarea de la última tocada (rastreado con un ref, no por fecha de
  creación — así funciona bien incluso cuando el "padre" es uno viejo
  reencontrado por nombre duplicado). Se renderizan indentadas con su
  propio checkbox y un contador "2/3" al lado del texto de la madre.
  Completarlas todas **no** completa la madre automáticamente — eso lo
  decide el usuario a mano. Escribir de nuevo el texto exacto de una
  tarea madre existente no crea un duplicado: solo pasa a ser el
  destino de las próximas líneas `>`. Borrar la madre borra sus
  sub-tareas en cascada (`parent_id ... on delete cascade`); el toast
  de deshacer trata al grupo completo (madre + hijas) como una unidad.
- **Filtros por tabs + chips** (`src/components/Filters.tsx`):
  "Activas" / "Links" / "Archivadas" son mutuamente excluyentes; los
  chips de `+proyecto`/`@contexto` filtran dentro de la vista actual
  (no aparecen en "Links", esas tareas por definición no tienen tags)
  y muestran un contador en vivo.
- **Tab "Links"** (`src/sort.ts`, función `isLinkOnly`): una tarea sin
  prioridad, sin `+proyecto`, sin `@contexto` pero con al menos un
  link se considera "solo un link guardado" y se muestra en su propia
  pestaña en vez de mezclarse con las tareas accionables de
  "Activas". Basta con agregar cualquier prioridad/tag para que vuelva
  a aparecer como tarea normal. El conteo de "pendientes" del masthead
  y el colofón usan las tareas de "Activas" (sin los links sueltos).
- **Orden configurable** (`src/sort.ts`, función `sortTasks`): además
  de los filtros, un control aparte ("ordenar: prioridad · fecha")
  cambia el criterio de orden de la lista que se esté viendo.
  Prioridad (default) = A→Z, sin prioridad al final. Fecha = por
  `due_date` ascendente, sin fecha al final. En ambos casos el
  desempate es por fecha de creación.
- **Completar** (checkbox circular) archiva la tarea con una
  transición de fade-out de ~220ms antes de moverla — no se pierde,
  queda en "Archivadas".
- **Editar**: doble click en el texto o "editar" (visible al hacer
  hover de la fila) → convierte la fila en un input con la línea raw
  completa (re-parsea al confirmar con Enter; Esc cancela).
- **Borrar con deshacer**: "borrar" quita la tarea de la vista al
  toque y muestra un toast ("Tarea borrada · deshacer") por 5
  segundos. El delete real contra Supabase se pospone hasta que pasa
  ese tiempo; si tocás "deshacer" antes, nunca se llegó a borrar en la
  base. Solo un deshacer pendiente a la vez — si borrás otra tarea
  mientras hay uno pendiente, el anterior se confirma al toque.
- **Atajo `/`** enfoca el input de captura desde cualquier parte de
  la página; **Esc** en el input cierra primero el autocompletado si
  está abierto, y si no, limpia/deselecciona el input.
- **Orden**: por prioridad (A→Z, sin prioridad al final con un "·"
  apagado), luego por fecha de creación.
- **Masthead dinámico**: el título resume el estado ("3 pendientes,
  dos con prioridad") en vez de un encabezado genérico; el colofón al
  final resume activas + completadas en la última semana. Todo en
  español, con números escritos en letras para conteos chicos
  (`src/format.ts`).
- **PWA instalable** (manifest + service worker vía `vite-plugin-pwa`,
  `registerType: 'autoUpdate'`): precachea el shell (JS/CSS/HTML/
  íconos/fuentes) para que la UI cargue offline. Los datos de tareas
  **no** se cachean — siempre vienen de Supabase.
- **Share Target** (`src/shareTarget.ts`): `/share-target` recibe
  `title`/`text`/`url` (desde el share sheet de Android, o desde el
  bookmarklet de escritorio — ver "Accesos rápidos") y arma una línea
  todo.txt precargada en el input para revisar/confirmar.
- **Resumen diario con IA** (Gemini, ver sección aparte más abajo):
  reemplaza el titular calculado por uno generado, en el mismo lugar y
  tipografía, con fallback automático al cálculo local si la IA falla.
- **Modo Noticias** (toggle "Agenda"/"Noticias" junto a la fecha, ver
  sección aparte más abajo): una segunda sección del mismo diario con
  ítems de RSS en vez de tareas, mismo lenguaje visual (líneas
  hairline, sin tarjetas), con su propio titular generado por IA. El
  modo elegido se guarda en `localStorage` y se recuerda entre
  sesiones.
- **Versión visible**: el colofón muestra `v{package.json version}`
  (inyectada en build time vía `vite.config.ts` → `define`). Bumpear a
  mano en cada cambio que se deployea, para que sea fácil notar cuándo
  se actualizó la página (el service worker cachea el shell y a veces
  no es obvio si ya tomó la versión nueva).

### Resumen diario con IA (Gemini)

Reemplaza el titular ("3 pendientes, dos con prioridad") por un
resumen de 1-2 frases generado por Gemini, cacheado en Postgres para
no llamar a la API en cada carga de página.

- **`api/summary.ts`**: función serverless de Vercel (Node, **no**
  Vite — no puede importar `src/lib/supabaseClient.ts` ni
  `tasksApi.ts` porque usan `import.meta.env`, que no existe en este
  runtime; arma su propio cliente de Supabase con `process.env` y la
  **service_role key**, que bypassea RLS). Junta las tareas activas de
  primer nivel (sin sub-tareas, sin los "solo link" de la tab Links),
  arma un prompt pidiéndole a Gemini (`gemini-2.5-flash-lite`) un
  resumen en el mismo tono lacónico del titular, con el texto de cada
  tarea ya limpio de URLs/tags/fecha (`stripTags`) — los links nunca
  se mandan a Google.
  - El modelo devuelve el resumen en dos partes separadas por `|||`
    (parte neutra + parte a resaltar en rojo); `format.splitSummary`
    las separa en el frontend para mantener el mismo tratamiento de
    acento que el titular calculado.
  - Si la llamada a Gemini falla, la función **no toca** el resumen
    cacheado existente (evita pisar un buen resumen con un error) y
    responde con status de error — el frontend simplemente sigue
    mostrando lo que tenía cacheado, o cae al titular local si nunca
    hubo un resumen guardado. Nunca se muestra un error crudo.
- **Auth de la función**: dos caminos válidos, sin endpoint público
  abierto (evita que cualquiera con la URL gaste la cuota de Gemini).
  - `GET` (lo usa el cron de Vercel): header
    `Authorization: Bearer <CRON_SECRET>` — Vercel lo agrega solo
    cuando el env var `CRON_SECRET` está seteado.
  - `POST` (botón manual "↻" al lado del titular, en `src/lib/summaryApi.ts`):
    header `Authorization: Bearer <access_token de la sesión>`,
    verificado server-side con `supabase.auth.getUser(token)`.
- **Disparo automático**: `vercel.json` → `crons` llama a
  `/api/summary` todos los días a las 9:00 UTC (6:00 en Argentina/
  Uruguay). El plan gratuito de Vercel permite cron jobs de hasta una
  vez por día, que es exactamente lo que necesitamos.
- **Tabla `daily_summary`**: una fila por usuario (`user_id` es la PK),
  con `summary` y `generated_at`. RLS solo permite `select` de la
  propia fila — únicamente la función serverless (con service_role)
  escribe.
- **Variables de entorno nuevas en Vercel** (Project Settings →
  Environment Variables, nunca en `.env` del repo):
  - `GEMINI_API_KEY` — de Google AI Studio (https://aistudio.google.com/apikey).
  - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role`.
  - `CRON_SECRET` — cualquier string random, generado una sola vez.
  - Reusa `VITE_SUPABASE_URL` ya existente (server-side, `process.env`
    ve todas las env vars del proyecto sin importar el prefijo `VITE_`,
    ese prefijo solo controla qué se bundlea al cliente).
- `api/tsconfig.json` es un tsconfig aparte solo para poder correr
  `tsc --noEmit -p api/tsconfig.json` localmente — Vercel compila la
  función con su propio bundler al deployar, no depende de esto.

### Modo Noticias (RSS + IA)

Segunda sección del diario: en vez de tareas, una lista de ítems de
RSS de ~10 feeds configurados a mano (Uruguay, política, tech, diseño
web, esports, deportes — ver `feeds` en `supabase/migrations/0004_feeds.sql`),
con un titular propio generado por Gemini con el mismo pipeline que el
resumen de tareas.

- **`api/news.ts`**: función serverless de Vercel, mismo patrón
  self-contained que `api/summary.ts` (sin imports de `../src`, cliente
  Supabase propio con la service_role key). En un solo request: (1)
  **ingesta** — trae la tabla `feeds`, parsea cada URL con
  `rss-parser` y hace `upsert` de los ítems nuevos en `feed_items`
  (dedup por `(feed_id, link)`, un feed caído no aborta los demás),
  (2) recién después arma el prompt con los ítems sin leer ya
  frescos + clima de Montevideo (mismo Open-Meteo que el resumen de
  tareas) y se lo manda a Gemini, (3) cachea el resultado en
  `news_summary`. El orden importa: ingerir antes de resumir, si no el
  titular describe la corrida anterior.
  - Mismo formato `|||` (parte neutra + parte a resaltar) y mismo
    fallback: si Gemini falla, no toca el cache existente y responde
    error — el frontend cae al cálculo local (`newsFallbackHeadline`/
    `newsColophonText` en `format.ts`).
  - Al prompt no se le pasan fechas ISO crudas para que las resuelva
    el modelo — mismo motivo que `describeDueDate` en `api/summary.ts`
    (un modelo chico haciendo aritmética de fechas alucina); en su
    lugar cada ítem lleva un rótulo ya resuelto ("hace 3h", "ayer").
- **Dos botones separados** (`NewsApp.tsx`, junto a la fecha): el ícono
  "↻" llama a `refreshFeeds()` (`/api/news?summary=0`) — solo ingesta,
  sin llamar a Gemini, pensado para tocar seguido. "regenerar titular"
  es el que sí gasta cuota (`regenerateNewsSummary()`, mismo endpoint
  sin el query param). El query param solo lo manda el botón manual; el
  cron nunca lo manda, así que siempre corre el pipeline completo.
- **Por qué un solo cron y no ingesta cada 1-4hs**: el plan gratuito
  de Vercel solo permite cron jobs una vez por día (igual que el
  resumen de tareas), así que `/api/news` no puede correr con más
  frecuencia sin pagar. La ingesta más frecuente que sí querés viene
  del botón manual "↻" (`regenerateNewsSummary` en
  `lib/newsSummaryApi.ts`), que dispara el mismo endpoint on-demand
  cuando abrís el modo Noticias — el cron diario es solo el piso
  mínimo si no abrís la app.
- **Auth de la función**: idéntica a `api/summary.ts` — `GET` con
  `CRON_SECRET` para el cron, `POST` con el `access_token` de la
  sesión para el botón manual.
- **Tablas**: `feeds` (id, name, url, muted) y `feed_items` (feed_id, title,
  link, published_at, read, fetched_at, únicos por `(feed_id, link)`)
  — RLS de solo lectura para el usuario autenticado, y también
  `update` en `feed_items` porque el toggle de leído/no leído corre en
  el cliente (con la anon key, no la service_role). `news_summary` es
  igual a `daily_summary` (una fila por usuario, solo la función
  serverless escribe).
- **Silenciar fuente** (chip → "silenciar"/"activar" al hover, columna
  `feeds.muted`): una fuente silenciada sigue apareciendo como chip con
  su conteo real, pero sus ítems se excluyen de "No leídas"/"Todas"
  (`NewsApp.tsx`, `mutedFeedIds`) — salvo que se la filtre puntualmente
  haciendo click en el chip, ahí se ve igual. Es una preferencia
  persistida en la tabla `feeds` (RLS de `update` para el usuario
  autenticado, igual que el toggle de leído en `feed_items`), no un
  estado local.
- **"→ todo"** (`NewsApp.tsx`, función `convertToTask`): arma una
  tarea nueva con `${título} ${link}` y la inserta directo con
  `insertTask` (mismo parser que Agenda, el link se detecta solo como
  URL) — no hace falta que `TaskApp` esté montado, cuando cambiés a
  Agenda esa tarea ya va a estar ahí porque `TaskApp` siempre refetchea
  al montar. También marca el ítem como leído.
- **Variables de entorno**: ninguna nueva — reusa
  `GEMINI_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/`CRON_SECRET` del
  resumen de tareas.

### Estructura

```
api/
  summary.ts                   # función serverless: genera/cachea el resumen IA de tareas
  news.ts                       # función serverless: ingesta RSS + resumen IA de noticias
  tsconfig.json                 # solo para tsc local, Vercel no lo usa
src/
  types.ts                  # Task, View, TagFilter, Mode, Feed, FeedItem, NewsView
  format.ts                  # texto en español: conteos, kicker, colofón,
                               # fecha, splitSummary, formatRelativeTime,
                               # newsFallbackHeadline, newsColophonText
  sort.ts                     # sortTasks (prioridad/fecha), isLinkOnly
  parser.ts                    # parseLine, stripTags, extractDueDate
                                 # (DATE_MATCHERS), tokenizeForHighlight, MONEY_RE
  shareTarget.ts               # consumeShareTarget (lee /share-target?...)
  lib/
    supabaseClient.ts          # cliente supabase-js, lee VITE_SUPABASE_*
    tasksApi.ts                 # fetch/insert/update/delete de la tabla tasks
    summaryApi.ts                # fetch/regenerate del resumen IA de tareas cacheado
    feedsApi.ts                   # fetch de feeds/feed_items, toggle de leído
    newsSummaryApi.ts              # fetch/regenerate del resumen IA de noticias cacheado
  hooks/
    useAuth.ts                   # sesión actual + suscripción a cambios
  components/
    Login.tsx                     # email + contraseña
    CaptureInput.tsx                # input con resaltado en vivo + autocompletado
    TaskRow.tsx                      # fila: check, pri-mark, body, meta, actions,
                                       # sub-tareas anidadas
    TaskList.tsx                      # solo renderiza; el orden lo decide TaskApp
    Filters.tsx                       # tabs Activas/Links/Archivadas + chips + orden
    ModeToggle.tsx                     # pastilla Agenda/Noticias, junto al kicker
    NewsFilters.tsx                     # tabs No leídas/Todas + chips por feed
    NewsList.tsx / NewsItemRow.tsx       # lista de ítems: dot leído/no leído,
                                           # título=link, "→ todo", toggle leído
    Toast.tsx                          # deshacer borrado
  App.tsx                    # auth gate + elige TaskApp o NewsApp según `mode`
  TaskApp.tsx                 # modo Agenda: estado, wiring, masthead/colofón
  NewsApp.tsx                  # modo Noticias: mismo layout, datos de feed_items
  App.css                     # tema editorial dark completo
public/
  icons/                      # icon-{192,512}.png, icon-maskable-*.png,
                                # apple-touch-icon.png (paleta acento/hueso)
  favicon.svg
scripts/
  gen-icons.py                 # regenera public/icons/*.png (requiere Pillow)
  set-password.mjs             # setea la contraseña vía Admin API (sin email)
supabase/
  schema.sql                  # tasks + daily_summary + feeds + feed_items +
                                # news_summary + políticas RLS (estado completo)
  migrations/
    0001_due_date.sql           # ALTER TABLE due_date
    0002_subtasks.sql            # ALTER TABLE parent_id
    0003_daily_summary.sql        # CREATE TABLE daily_summary
    0004_feeds.sql                  # CREATE TABLE feeds/feed_items/news_summary
                                      # + seed de los feeds configurados
    0005_feed_muted.sql               # ALTER TABLE feeds ADD muted
    0006_feeds_update.sql              # ajusta la lista de feeds (altas/bajas)
                                         # (correr en orden en proyectos ya creados)
vite.config.ts                # VitePWA: manifest + workbox + share_target;
                                # __APP_VERSION__ desde package.json
vercel.json                   # rewrite SPA (excluye /api) + 2 crons diarios
.env.example                  # variables VITE_SUPABASE_URL/ANON_KEY
```

## Ideas "nice to have" (no urgentes, anotadas para después)

- Acceso rápido desde el celular (Samsung S23 Ultra) con algún atajo
  al estilo accesos de accesibilidad de Android (ej. gesto o botón
  asignable que abra la PWA directo, sin pasar por el share sheet).
  Ya se armaron dos alternativas más simples y ya funcionando: acceso
  directo en la pantalla de bloqueo y comando de voz de Google
  Assistant ("Abrí Todos"). Un atajo de accesibilidad *real* requeriría
  empaquetar la PWA como Trusted Web Activity nativa (Android
  Studio/Gradle) con un servicio de accesibilidad dummy — evaluado y
  descartado por ahora por el costo/beneficio.
- SMTP propio (Gmail o Resend) si en algún momento se quiere volver a
  magic link u otros emails transaccionales sin el rate limit del
  servicio compartido de Supabase — no urgente ahora que el login es
  por contraseña.

## Decisiones / notas para retomar

- El parser (`parseLine`) solo devuelve los campos derivados de una
  línea; no construye un `Task` completo. El `id`/`created_at` los
  genera Postgres (`gen_random_uuid()` / `default now()`), no el
  cliente — evita desincronización entre dispositivos.
- Prioridad, categorías, contextos y fecha son 100% derivados del
  texto de las tareas en cada parseo — no hay tablas separadas que
  mantener sincronizadas. La contrapartida (documentada arriba) es
  que una fecha relativa como "el sábado" se recalcula contra el
  momento del parseo, no queda "congelada" al momento de creación.
- RLS en `tasks` filtra por `auth.uid() = user_id` en las 4
  operaciones (select/insert/update/delete), aunque sea un solo
  usuario — así la anon key nunca puede leer/escribir datos de otra
  cuenta si en algún momento se agrega un segundo usuario.
- Login por contraseña (no magic link): el servicio de email
  compartido de Supabase tiene un rate limit muy bajo (pensado para
  pruebas), que se agotaba rápido con un solo usuario probando
  seguido. `scripts/set-password.mjs` usa la **service_role key**
  (nunca la anon key, nunca committeada) para setear la contraseña
  vía Admin API sin depender de ningún email.
- Sin optimistic UI en la mayoría de las mutaciones (esperan la
  respuesta de Supabase antes de tocar el estado local), **excepto**
  el borrado, que sí es optimista con ventana de deshacer de 5s
  (soft-delete solo en el cliente hasta que expira el timeout).
- No se usó ningún framework de UI pesado ni librería de manejo de
  estado (Redux/Zustand) — a propósito, dado el tamaño de la app.
- Versionado visible: bumpear `version` en `package.json` (semver
  informal, no hay releases/tags todavía) en cada commit que se
  deployea. Pedido explícito del usuario para notar cuándo la PWA
  instalada (que cachea el shell vía service worker) ya tomó los
  cambios nuevos.
- PWA: se usó `vite-plugin-pwa` (Workbox) en vez de escribir el
  service worker a mano. `devOptions.enabled: true` lo registra
  también en `npm run dev` para probar instalación/offline antes de
  deployar. Ojo al testear cambios: el SW cachea el shell, así que una
  ventana de PWA ya abierta puede mostrar la versión vieja hasta
  cerrarla y reabrirla (o `Ctrl+Shift+R`).
- Los íconos son generados por `scripts/gen-icons.py` (Pillow) con los
  colores del tema editorial (acento rojo + hueso), no son archivos de
  diseño a mano.
- Accesos rápidos ya resueltos sin tocar código de la app: atajo de
  teclado en PC (`Ctrl+Alt+T` sobre el `.lnk` de la PWA instalada,
  Propiedades → Acceso directo → Tecla de método abreviado) y un
  bookmarklet de Edge que reutiliza `/share-target` para mandar
  cualquier link de escritorio a la app con un click.
- Modo Noticias: la ingesta de RSS y el resumen IA viven en el mismo
  endpoint (`api/news.ts`) disparado por un solo cron diario, en vez
  de un cron aparte cada 1-4hs — decisión explícita del usuario al
  toparse con que Vercel free solo permite cron una vez por día. La
  frescura "real" viene de tocar el botón manual "↻" al abrir el modo,
  no de la automatización.
