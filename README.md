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
  - **Fechas relativas en español**: `el sábado`, `el próximo sábado`,
    `hoy`, `mañana`, `pasado mañana` — se resuelven a una fecha
    concreta y se muestran como badge en la tarea.
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
  pendientes, dos con prioridad") en vez de un encabezado fijo.

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
- Tema oscuro "editorial": Fraunces + Instrument Sans + IBM Plex Mono,
  acento usado con moderación (solo prioridad alta y estados de foco).

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
  deploy automático en cada push a `main`.

## Correrlo localmente

```bash
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto de Supabase
npm run dev
```

Necesitás un proyecto propio de Supabase:

1. Crear proyecto gratis en https://supabase.com.
2. Correr `supabase/schema.sql` en el SQL Editor (crea la tabla
   `tasks` con RLS). Si el proyecto es de antes de la fecha de este
   commit, correr también lo que haya en `supabase/migrations/`.
3. Copiar `Project URL` y `anon public key` (Project Settings → API) a
   `.env`.
4. Setear la contraseña del usuario con `scripts/set-password.mjs`
   (usa la Admin API de Supabase, no manda ningún email — ver
   comentarios en el script).

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
