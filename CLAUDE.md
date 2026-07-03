# todos — app personal de tareas (PWA)

App de una sola lista de tareas, un solo usuario, sintaxis estilo
todo.txt, pensada para vivir 24/7 en Android y PC con hosting gratis.

## Stack

- Vite + React + TypeScript, sin librerías de estado ni UI kit.
- CSS plano (`src/App.css`), tema oscuro por defecto.
- Datos: Supabase (Postgres + auth por email/contraseña, RLS por `user_id`).
- Deploy: Vercel (free tier), conectado a GitHub para deploy automático.

## Estado actual: Paso 4 completo — deployado, con accesos rápidos

**URL de producción: https://mario-to-do.vercel.app**

- Repo: https://github.com/mamricca/marioToDo (rama `main`).
- Deploy: Vercel, importado desde GitHub — cada `git push` a `main`
  dispara un deploy automático. Vite se detecta solo (build
  `vite build`, output `dist`).
- Variables de entorno cargadas en Vercel (Project Settings →
  Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `vercel.json` tiene un rewrite catch-all a `/index.html` — necesario
  para que rutas como `/share-target` (que no existen como archivo)
  las resuelva el router del lado del cliente en vez de tirar 404.
- Verificado en producción (HTTPS real): manifest, service worker,
  íconos y `/share-target` responden bien. Login, PWA instalada y
  share target de Android probados end-to-end contra el dominio de
  Vercel.

### Login: email + contraseña (no magic link)

Se cambió de magic link a `signInWithPassword` porque el servicio de
email compartido de Supabase (el que manda los magic links por
defecto) tiene un rate limit muy bajo, pensado solo para pruebas —
con un solo usuario probando seguido se agotaba enseguida.

- `src/components/Login.tsx` pide email + contraseña y llama
  `supabase.auth.signInWithPassword`.
- La contraseña se setea (o cambia) con `scripts/set-password.mjs`,
  un script one-off que usa la **service_role key** de Supabase (no
  la anon key) para setearla vía Admin API sin mandar ningún email.
  Uso: variables de entorno `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `EMAIL`, `PASSWORD` en la terminal (nunca se guardan en archivo) y
  `node scripts/set-password.mjs`. La service_role key nunca va en
  `.env` del proyecto ni se commitea — es de un solo uso manual.
- Si en algún momento se quiere volver a habilitar magic link (por
  ejemplo si se agrega un SMTP propio), sería agregar de nuevo el
  flujo `signInWithOtp` — no hay nada más atado a la decisión actual.

### Accesos rápidos (lo pedido como "nice to have", ya resuelto)

- **Atajo de teclado en PC** (`Ctrl+Alt+T`, elegido por el usuario):
  no es código de la app, es una "Tecla de método abreviado" seteada
  a nivel Windows sobre el acceso directo (`.lnk`) que crea Edge al
  instalar la PWA. Se configura así: Menú Inicio → buscar "Todos" →
  click derecho → Abrir ubicación del archivo → click derecho sobre
  el `.lnk` → Propiedades → pestaña "Acceso directo" → campo "Tecla
  de método abreviado" → presionar una letra (Windows arma
  `Ctrl+Alt+<letra>` solo). Si el `.lnk` apunta a `localhost` en vez
  del dominio de producción, hay que reinstalar la PWA desde la URL
  real — la sesión de login queda guardada por origen, así que un
  `.lnk` viejo a localhost nunca va a recordar la sesión de producción.
- **Compartir un link desde Edge/PC → Todos**: se probó el share
  nativo de Windows (ícono "Compartir" de Edge → panel de Windows) y
  **no lista PWAs instaladas como destino** en este equipo — no es
  confiable. En su lugar se usa un **bookmarklet** en la barra de
  favoritos que reutiliza la misma ruta `/share-target` que ya existe
  para Android:
  ```
  javascript:(function(){window.open('https://mario-to-do.vercel.app/share-target?title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href),'_blank')})()
  ```
  Se instala editando la URL de un favorito (pegar ese código como
  URL). Al clickearlo en cualquier página, abre una pestaña nueva de
  Todos con el input precargado con título + link de esa página. Cero
  código nuevo — corre 100% sobre la infraestructura de share target
  que ya estaba armada para el celular.
- **Acceso rápido desde el Samsung S23 Ultra** (atajo estilo
  accesibilidad, sin pasar por el share sheet): sigue pendiente,
  anotado para revisar más adelante.

## Estado anterior: Paso 3 — PWA instalable + Share Target

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
4. Setear la contraseña del usuario con `scripts/set-password.mjs`
   (ver sección de login arriba) — no hace falta configurar Redirect
   URLs para magic link porque ya no se usa.
5. `npm run dev` y entrar con el propio email + esa contraseña.

### Qué hace

- Login por email + contraseña (`src/components/Login.tsx` +
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
  Android (method GET, params `title`/`text`/`url`) y también del
  bookmarklet de escritorio (ver arriba). Al abrir esa ruta, se arma
  una línea todo.txt con esos valores (sin duplicar si coinciden) y
  se precarga+enfoca el input de captura para que revises/agregues
  tags y confirmes con Enter — no se guarda solo automáticamente.

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
    Login.tsx                  # email + contraseña
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
  set-password.mjs             # setea la contraseña vía Admin API (sin email)
supabase/
  schema.sql                  # tabla tasks + políticas RLS
vite.config.ts                # VitePWA: manifest + workbox + share_target
.env.example                  # variables VITE_SUPABASE_URL/ANON_KEY
```

## Roadmap

1. ✅ Prototipo local con estado en memoria y parser todo.txt.
2. ✅ Supabase conectado: tabla `tasks` + auth, RLS por `user_id`.
3. ✅ PWA instalable (`vite-plugin-pwa`, manifest + service worker con
   precache del shell) + Share Target (`/share-target`), probado en
   Android real.
4. ✅ Deploy en Vercel + accesos rápidos: atajo de teclado en PC
   (`Ctrl+Alt+T` sobre el `.lnk` de la PWA instalada) y bookmarklet
   de Edge para compartir links desde escritorio.

Queda pendiente (no bloqueante): acceso rápido tipo accesibilidad
desde el Samsung S23 Ultra (ver más abajo).

## Ideas "nice to have" (no urgentes, anotadas para después)

- Acceso rápido desde el celular (Samsung S23 Ultra) con algún atajo
  al estilo accesos de accesibilidad de Android (ej. gesto o botón
  asignable que abra la PWA directo, sin pasar por el share sheet).
  Pendiente de investigar cómo se implementa (Android no da un
  "atajo global" trivial para abrir una PWA salvo vía ícono/widget/
  Accessibility Shortcut/Edge panel según el launcher).
- SMTP propio (Gmail o Resend) si en algún momento se quiere volver a
  magic link u otros emails transaccionales sin el rate limit del
  servicio compartido de Supabase — no urgente ahora que el login es
  por contraseña.

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
  desde DevTools → Application. Ojo al testear cambios: el SW
  cachea el shell, así que una ventana de PWA ya abierta puede mostrar
  la versión vieja hasta cerrarla y reabrirla (o `Ctrl+Shift+R`).
- Los íconos son generados por `scripts/gen-icons.py` (Pillow), no
  son archivos de diseño a mano — un cuadrado azul (`--accent`) con
  un check blanco. Si se quiere un logo real más adelante, reemplazar
  ese script o los PNGs directamente en `public/icons/`.
