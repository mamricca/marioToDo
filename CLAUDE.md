# todos — app personal de tareas (PWA)

App de una sola lista de tareas, un solo usuario, sintaxis estilo
todo.txt, pensada para vivir 24/7 en Android y PC con hosting gratis.

## Stack

- Vite + React + TypeScript, sin librerías de estado ni UI kit.
- CSS plano (`src/App.css`), tema oscuro por defecto.
- Datos: Supabase (Postgres + auth por magic link, RLS por `user_id`).
- Deploy futuro: Cloudflare Pages o Vercel (free tier).

## Estado actual: Paso 3 completo — PWA instalable + Share Target

Requiere un proyecto de Supabase propio (ver "Cómo correrlo" abajo).
Ya no hay estado en memoria: todo se lee/escribe contra Postgres.

```
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto
npm run dev
```

### Cómo correrlo (setup de Supabase)

1. Crear proyecto gratis en https://supabase.com.
2. En el SQL Editor del proyecto, correr `supabase/schema.sql` (crea
   la tabla `tasks` con Row Level Security restringida a
   `auth.uid() = user_id`).
3. En Project Settings → API, copiar `Project URL` y `anon public key`
   a `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. En Authentication → URL Configuration, agregar la URL donde corra
   la app (`http://localhost:5173` en dev, el dominio de producción
   más adelante) a "Redirect URLs" para que el magic link funcione.
5. `npm run dev` y entrar con el propio email (magic link, sin
   password — es una app de un solo usuario).

### Qué hace

- Login por magic link (`src/components/Login.tsx` +
  `src/hooks/useAuth.ts`): sin sesión no se ve nada de la app.
- Input de captura rápida (`src/components/TaskInput.tsx`) que acepta
  líneas estilo todo.txt: `(A) Terminar informe +trabajo @compu https://ejemplo.com`
- Parser (`src/parser.ts`, función `parseLine`) reconoce:
  - Prioridad `(A)`–`(Z)` al inicio de línea.
  - Categorías `+proyecto` y contextos `@contexto` en cualquier parte
    del texto.
  - URLs `http(s)://...`, enmascaradas antes de buscar `+`/`@` para
    que no matcheen dentro de query strings.
- Render de texto (`src/components/TaskText.tsx`) muestra URLs como
  links clickeables y resalta tags `+`/`@` con color.
- Filtros (`src/components/FilterBar.tsx`): "Todas", una entrada por
  cada categoría/contexto detectado (se generan solos a partir de las
  tareas existentes, no hay que declararlos aparte), y toggle de
  "Archivadas".
- Completar (checkbox) archiva la tarea en vez de borrarla — queda en
  la sección "Archivadas", no se pierde.
- Editar: doble click en el texto o botón ✎ → convierte la fila en un
  input editable con la línea raw completa (re-parsea al confirmar).
- Borrar: botón ✕, elimina definitivamente (delete real en la DB).
- Atajo de teclado `/` enfoca el input de captura desde cualquier
  parte de la página (no interfiere si ya estás escribiendo en otro
  campo).
- Orden de la lista: por prioridad (A→Z, sin prioridad al final),
  luego por fecha de creación.
- Cada mutación (agregar/editar/completar/borrar) espera la respuesta
  de Supabase antes de reflejarse en la UI — sin optimistic updates
  todavía, para mantener el código simple. Si falla, se muestra un
  banner de error debajo del input (click para descartarlo).
- PWA instalable (manifest + service worker vía `vite-plugin-pwa`,
  `registerType: 'autoUpdate'`): precachea el shell (JS/CSS/HTML/
  íconos) para que la UI cargue offline. Los datos de tareas **no**
  se cachean — siempre vienen de Supabase, así que offline ves la
  app pero no podés cargar/guardar tareas sin red. Eso es lo que
  pide el requisito de "soporte offline básico".
- Share Target (`src/shareTarget.ts`): la entrada `share_target` del
  manifest registra `/share-target` como destino del share sheet de
  Android (method GET, params `title`/`text`/`url`). Al abrir esa
  ruta, se arma una línea todo.txt con esos valores (sin duplicar si
  coinciden) y se precarga+enfoca el input de captura para que
  revises/agregues tags y confirmes con Enter — no se guarda solo
  automáticamente.

### Estructura

```
src/
  types.ts                # Task, Filter
  parser.ts                # parseLine (prioridad/proyectos/contextos/urls)
  shareTarget.ts            # consumeShareTarget (lee /share-target?...)
  lib/
    supabaseClient.ts       # cliente supabase-js, lee VITE_SUPABASE_*
    tasksApi.ts              # fetch/insert/update/delete de la tabla tasks
  hooks/
    useAuth.ts                # sesión actual + suscripción a cambios
  components/
    Login.tsx                  # magic link
    TaskInput.tsx
    TaskText.tsx                # linkifica URLs + resalta tags
    TaskItem.tsx
    TaskList.tsx                 # ordena por prioridad
    FilterBar.tsx
  App.tsx                    # auth gate: Login o TaskApp
  TaskApp.tsx                 # la app en sí (ex-App.tsx del paso 1)
  App.css                     # tema oscuro
public/
  icons/                      # icon-{192,512}.png, icon-maskable-*.png,
                                # apple-touch-icon.png
  favicon.svg
scripts/
  gen-icons.py                 # regenera public/icons/*.png (requiere Pillow)
supabase/
  schema.sql                  # tabla tasks + políticas RLS
vite.config.ts                # VitePWA: manifest + workbox + share_target
.env.example                  # variables VITE_SUPABASE_URL/ANON_KEY
```

## Roadmap

1. ✅ Prototipo local con estado en memoria y parser todo.txt.
2. ✅ Supabase conectado: tabla `tasks` + auth con magic link (único
   usuario), RLS por `user_id`. Verificado end-to-end: login con
   magic link + tarea creada y persistida (proyecto `dirkbtumgmxmacrrgzwd`).
3. ✅ PWA instalable (`vite-plugin-pwa`, manifest + service worker con
   precache del shell) + Share Target (`/share-target`). Instalación
   "Agregar a inicio" y offline del shell probables ya en localhost
   (dev server con `devOptions.enabled: true`); el share sheet real
   de Android **solo aparece con la PWA instalada desde un origen
   HTTPS** (localhost del PC no cuenta desde el celular) — probar
   share target de punta a punta queda pendiente hasta el paso 4.
4. ⬜ Deploy en Cloudflare Pages o Vercel + instrucciones de
   publicación para el usuario.

## Ideas "nice to have" (no urgentes, anotadas para después)

- Acceso rápido a la app con atajo de teclado global en PC (a nivel
  SO, no solo dentro de la página — algo tipo lanzar/foco de la PWA
  instalada con una combinación de teclas).
- Acceso rápido desde el celular (Samsung S23 Ultra) con algún atajo
  al estilo accesos de accesibilidad de Android (ej. gesto o botón
  asignable que abra la PWA directo). Pendiente de investigar cómo se
  implementa (Android no da un "atajo global" trivial para abrir una
  PWA salvo vía ícono/widget/Accessibility Shortcut/Edge panel según
  el launcher) — se revisa más a fondo cuando lleguemos a esa etapa.

## Decisiones / notas para retomar

- El parser (`parseLine`) solo devuelve los campos derivados de una
  línea; no construye un `Task` completo. El `id`/`created_at` los
  genera Postgres (`gen_random_uuid()` / `default now()`), no el
  cliente — evita desincronización entre dispositivos.
- Prioridad y categorías/contextos son 100% derivados del texto de las
  tareas — no hay una tabla separada de "proyectos" o "contextos" que
  mantener sincronizada.
- RLS en `tasks` filtra por `auth.uid() = user_id` en las 4
  operaciones (select/insert/update/delete), aunque sea un solo
  usuario — así la anon key nunca puede leer/escribir datos de otra
  cuenta si en algún momento se agrega un segundo usuario.
- Sin optimistic UI todavía: las mutaciones esperan la respuesta de
  Supabase antes de tocar el estado local. Si se siente lento en el
  celular con mala señal, next step sería optimistic updates con
  reconciliación por id temporal — no implementado por simplicidad.
- No se usó ningún framework de UI pesado ni librería de manejo de
  estado (Redux/Zustand) — a propósito, dado el tamaño de la app.
- PWA: se usó `vite-plugin-pwa` (Workbox) en vez de escribir el
  service worker a mano, para evitar bugs de cacheo manual (versionado
  de cache, invalidación). `devOptions.enabled: true` registra el SW
  también en `npm run dev` para poder probar instalación/offline
  antes de deployar — si algún día molesta durante desarrollo (cache
  viejo pegado), se puede desactivar o hacer "Unregister" del SW
  desde DevTools → Application.
- Los íconos son generados por `scripts/gen-icons.py` (Pillow), no
  son archivos de diseño a mano — un cuadrado azul (`--accent`) con
  un check blanco. Si se quiere un logo real más adelante, reemplazar
  ese script o los PNGs directamente en `public/icons/`.
