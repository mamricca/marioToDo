# Todos

App personal de lista de tareas, estilo **todo.txt**, para un solo
usuario. Pensada para vivir 24/7 en el celular (Android) y la PC,
instalable como PWA, con hosting 100% gratuito.

**En producción:** https://mario-to-do.vercel.app

## Features

### Captura y sintaxis

- Captura rápida en un solo input, con **resaltado de sintaxis en
  vivo** mientras escribís:
  ```
  (A) Terminar informe +trabajo @compu el sábado https://ejemplo.com
  ```
  - **Prioridad** `(A)`–`(Z)` al inicio de línea.
  - **Categorías** `+proyecto` y **contextos** `@contexto` en
    cualquier parte del texto.
  - **URLs** `http(s)://...`, detectadas y mostradas como link
    clickeable.
  - **Fechas en español**: relativas (`el sábado`, `el próximo sábado`,
    `hoy`, `mañana`, `pasado mañana`, `en 3 días`, `en una semana`) o
    absolutas (`4 de julio`, `15/8`, `2026-07-15`) — se resuelven a
    una fecha concreta y se muestran como badge en la tarea.
  - **Montos**: `$45000`, `$1.234,56` se resaltan en dorado, sin
    sacarlos del texto (a diferencia de tags/fecha/links).
- **Sub-tareas**: escribir `> comprar pasajes` después de una tarea la
  agrega como sub-tarea indentada, con su propio checkbox y un
  contador "2/3" — completarlas no completa la tarea madre sola.
- **Autocompletado** de `+proyecto` y `@contexto` ya usados: al
  escribir `+` o `@` aparece un dropdown filtrable, navegable con
  flechas y Enter/Tab.
- Atajo `/` enfoca el input desde cualquier parte de la página; `Esc`
  cierra el autocompletado o limpia el input.

### Organización

- **Tabs**: Activas / Links / Archivadas.
  - Una tarea sin prioridad, sin `+proyecto` ni `@contexto` pero con
    un link se trata como "link guardado" y vive en su propia pestaña
    en vez de mezclarse con las tareas accionables.
- **Chips** de `+proyecto`/`@contexto` con contador en vivo, para
  filtrar dentro de la vista actual.
- **Orden configurable**: por prioridad (A→Z) o por fecha, con un
  toggle aparte de los filtros.
- El título de la página resume el estado en lenguaje natural ("3
  pendientes, dos con prioridad"), opcionalmente **generado por IA**
  (Gemini) — ver sección aparte más abajo. Con fallback automático al
  cálculo local si la IA no está configurada o falla.

### Edición y borrado

- Completar (checkbox) archiva la tarea con una transición suave — no
  se pierde, queda en "Archivadas".
- Editar con doble click o el link "editar" (aparece al pasar el
  mouse); re-parsea la línea completa al confirmar.
- Borrar con **deshacer**: un toast de 5 segundos antes de que el
  borrado sea definitivo.

### PWA / multiplataforma

- **Instalable** en Android y escritorio (manifest + service worker),
  con soporte offline básico del shell de la app.
- **Share Target**: compartís un link desde Chrome en Android (o un
  bookmarklet en desktop) directo a la app, que arma la tarea con
  título + URL.
- Tema oscuro "editorial": Newsreader (titular) + Hanken Grotesk (UI) +
  JetBrains Mono (sintaxis), acento usado con moderación (solo
  prioridad alta y estados de foco).
- Número de versión visible en el pie de página (`v0.1.x`) — útil para
  notar cuándo la PWA instalada ya tomó una actualización, dado que el
  service worker cachea el shell.

### Resumen diario con IA (opcional)

- El titular puede reemplazarse por un resumen de 1-2 frases generado
  por **Gemini** (`gemini-2.5-flash-lite`), con una voz editorial
  personal: parafrasea las tareas (no las copia tal cual), prioriza lo
  vencido y la prioridad alta, pero también da panorama general en vez
  de listar sin criterio.
- Incorpora el **clima del día en Montevideo** ([Open-Meteo](https://open-meteo.com/),
  gratis y sin API key) como parte del panorama, no como un dato
  aparte.
- Se recalcula solo una vez por día (cron de Vercel) y se cachea en la
  base — no se llama a la API en cada carga de página. Un botón
  discreto (↻) al lado del titular permite regenerarlo manualmente en
  cualquier momento.
- Si la IA falla (sin cuota, sin conexión, etc.) el titular cae al
  cálculo local automáticamente — nunca se muestra un error ni queda
  vacío.
- Requiere configurar variables de entorno propias (ver "Correrlo
  localmente" abajo); sin ellas la app funciona igual, solo sin este
  agregado.

### Cuenta

- Login por email + contraseña (pensado para un solo usuario).
- Todo persiste en Postgres (Supabase), con Row Level Security por
  usuario.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) +
  TypeScript, sin librerías de estado ni UI kit.
- [Supabase](https://supabase.com/) (Postgres + Auth), acceso vía
  `@supabase/supabase-js`.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) para
  manifest + service worker.
- Deploy en [Vercel](https://vercel.com/), conectado a GitHub para
  deploy automático en cada push a `main`. Una función serverless
  (`api/summary.ts`) + un cron diario generan el resumen con la
  [API de Gemini](https://aistudio.google.com/apikey) (opcional).

## Correrlo localmente

```bash
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto de Supabase
npm run dev
```

Necesitás un proyecto propio de Supabase:

1. Crear proyecto gratis en https://supabase.com.
2. Correr `supabase/schema.sql` en el SQL Editor (crea las tablas
   `tasks` y `daily_summary` con RLS). Si el proyecto es de antes de
   la fecha de este commit, correr también lo que haya en
   `supabase/migrations/`, en orden.
3. Copiar `Project URL` y `anon public key` (Project Settings → API) a
   `.env`.
4. Setear la contraseña del usuario con `scripts/set-password.mjs`
   (usa la Admin API de Supabase, no manda ningún email — ver
   comentarios en el script).

Opcional, para el resumen con IA (si se omite, la app funciona igual
sin este agregado) — variables de entorno en **Vercel** (Project
Settings → Environment Variables, nunca en `.env` del repo):

| Variable | De dónde sale |
| --- | --- |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (gratis) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
| `CRON_SECRET` | Cualquier string random que generes vos, una sola vez |

`VITE_SUPABASE_URL` no hace falta duplicarla — la función serverless
la reusa vía `process.env` aunque tenga el prefijo `VITE_`, ese
prefijo solo afecta qué se bundlea al cliente.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye el service worker) |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | Lint con oxlint |
| `python scripts/gen-icons.py` | Regenera los íconos de `public/icons/` |

## Notas de diseño

Detalles de arquitectura, decisiones tomadas y roadmap en
[`CLAUDE.md`](CLAUDE.md).
