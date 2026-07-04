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

## Estado actual: deployado, rediseñado, con fechas relativas

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
6. `npm run dev`.

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

### Estructura

```
src/
  types.ts                  # Task, View, TagFilter
  format.ts                  # texto en español: conteos, kicker, colofón, fecha
  sort.ts                     # sortTasks (prioridad/fecha), isLinkOnly
  parser.ts                    # parseLine, stripTags, extractDueDate,
                                 # tokenizeForHighlight
  shareTarget.ts               # consumeShareTarget (lee /share-target?...)
  lib/
    supabaseClient.ts          # cliente supabase-js, lee VITE_SUPABASE_*
    tasksApi.ts                 # fetch/insert/update/delete de la tabla tasks
  hooks/
    useAuth.ts                   # sesión actual + suscripción a cambios
  components/
    Login.tsx                     # email + contraseña
    CaptureInput.tsx                # input con resaltado en vivo + autocompletado
    TaskRow.tsx                      # fila: check, pri-mark, body, meta, actions
    TaskList.tsx                      # solo renderiza; el orden lo decide TaskApp
    Filters.tsx                       # tabs Activas/Links/Archivadas + chips + orden
    Toast.tsx                          # deshacer borrado
  App.tsx                    # auth gate: Login o TaskApp
  TaskApp.tsx                 # la app en sí: estado, wiring, masthead/colofón
  App.css                     # tema editorial dark completo
public/
  icons/                      # icon-{192,512}.png, icon-maskable-*.png,
                                # apple-touch-icon.png (paleta acento/hueso)
  favicon.svg
scripts/
  gen-icons.py                 # regenera public/icons/*.png (requiere Pillow)
  set-password.mjs             # setea la contraseña vía Admin API (sin email)
supabase/
  schema.sql                  # tabla tasks + políticas RLS (estado completo)
  migrations/
    0001_due_date.sql           # ALTER TABLE due_date (correr en proyectos ya
                                  # creados antes de esta fecha)
vite.config.ts                # VitePWA: manifest + workbox + share_target
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
- Fechas relativas: por ahora solo días de la semana + hoy/mañana/
  pasado mañana. Si hace falta, se podría sumar "en N días", fechas
  absolutas (`15/8`), o un segundo campo de prioridad temporal
  distinto del recálculo dinámico actual (ver nota en "Decisiones").

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
