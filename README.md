# CAM Donaciones

Sistema interno de gestión de donantes para **Comedores Sociales de Puerto Rico**.
Permite registrar, consultar e importar donantes, y genera reportes para el equipo administrativo.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · **Supabase**
(Postgres + RLS) · **Tailwind CSS 4** · Server Actions · desplegado en **Netlify**.

## Cómo correr localmente

1. `npm install`
2. Crea un proyecto en [Supabase](https://supabase.com).
3. En el **SQL Editor** de Supabase, ejecuta en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_triggers.sql`
4. Copia `.env.local.example` → `.env.local` y rellena los valores
   (Project Settings → API): URL, anon key, **service_role key**, y elige un
   `ADMIN_PASSWORD` + un `ADMIN_SESSION_SECRET` (hex aleatorio de 32 bytes).
5. `npm run dev` → http://localhost:3000

## Rutas

| Ruta | Acceso | Qué hace |
|---|---|---|
| `/` | — | Redirige a `/panel` |
| `/admin/login` | público | Acceso por contraseña |
| `/panel` | protegido | Panel principal |
| `/donantes` | protegido | Lista y gestión de donantes |
| `/import` | protegido | Importar donantes desde CSV/Excel |

## Seguridad

Todas las rutas excepto `/admin/login` requieren sesión. La sesión se protege con
contraseña compartida + cookie firmada (`requireAdmin()` en cada acción **y** en
`src/proxy.ts`). Las tablas sensibles tienen RLS **deny-all** para la anon key;
toda escritura/lectura sensible pasa por Server Actions con el cliente service-role
(`src/lib/supabase/admin.ts`).

## Comandos

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run lint` — ESLint
- `npm run test` — pruebas unitarias (vitest)
