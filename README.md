# PsicoGestión

Aplicación web de gestión psicológica con backend REST y frontend web en un monorepo npm.

## Stack técnico

- **Backend:** Node.js 18+, Express 4, Sequelize 6, Zod y Umzug.
- **Frontend:** Next.js 16, React 19 y TypeScript.
- **Bases de datos:** SQLite para desarrollo local y pruebas; PostgreSQL y MySQL están disponibles para otros entornos.
- **Pruebas:** Jest y Supertest; la suite puede ejecutarse contra SQLite o PostgreSQL.
- **Calidad:** ESLint, Prettier, TypeScript y EditorConfig.

## Requisitos

- Node.js 20.19+, 22.13+ o 24+, y npm 7 o superior.
- PostgreSQL solo para ejecutar la suite PostgreSQL o desplegar con ese motor.

## Instalación

Desde la raíz del repositorio:

```bash
npm install
```

Copia `.env.example` como `.env` y configura las variables necesarias. SQLite es la base de datos predeterminada en desarrollo:

```bash
cp .env.example .env
```

## Desarrollo y producción

```bash
npm run dev                 # backend y frontend
npm run dev:server          # solo backend (puerto 4000)
npm run dev:client          # solo frontend (puerto 3000)
npm run build:client
npm run start:server
npm run start:client
```

El backend aplica las migraciones automáticamente al iniciar en desarrollo. En producción, ejecútalas durante el despliegue con `npm run migrate`.

### Despliegue recomendado

Usa tres servicios separados:

1. **Neon:** crea una base PostgreSQL y copia su cadena de conexión (`DATABASE_URL`).
2. **Render (backend):** conecta el repositorio y configura:
   - Build Command: `npm install`
   - Start Command: `npm run start:server`
   - Health Check Path: `/health/ready`
3. **Vercel (frontend):** importa el repositorio usando `front` como Root Directory y configura
   `NEXT_PUBLIC_API_URL` con la URL pública de Render, sin una barra final.

Variables mínimas del backend en Render:

```text
NODE_ENV=production
DATABASE_URL=<cadena de Neon>
DB_DIALECT=postgres
DB_SSL=true
JWT_SECRET=<mínimo 32 caracteres aleatorios>
APP_URL=https://<tu-proyecto>.vercel.app
CORS_ORIGINS=https://<tu-proyecto>.vercel.app
CORS_ORIGIN_PATTERNS=https://<tu-proyecto>-*-<tu-equipo>.vercel.app
EMAIL_TRANSPORT=api
BREVO_API_KEY=<clave de API de Brevo con permiso "Emails transaccionales: Todos">
EMAIL_FROM=<correo verificado en Brevo>
EMAIL_FROM_NAME=PsicoGestión
DB_AUTO_MIGRATE=false
```

`EMAIL_TRANSPORT=api` envía por la **API HTTPS de Brevo** (`https://api.brevo.com/v3/smtp/email`,
puerto 443). Es obligatorio en Render free: los puertos SMTP salientes 25/465/587 están
bloqueados. En desarrollo puedes usar `EMAIL_TRANSPORT=smtp` con `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (consulta `.env.example`).

`CORS_ORIGIN_PATTERNS` es opcional. Autoriza los previews de Vercel, cuyo hash cambia en cada
deploy; el `*` solo coincide con caracteres de hostname. Mantenlo acotado al prefijo de tu
proyecto: `https://*.vercel.app` permitiría a cualquier proyecto de Vercel enviar peticiones con
credenciales a tu backend.

Después de configurar las variables, usa `npm run migrate` como Deploy Command de Render
(antes de iniciar el servicio) o ejecútalo una vez desde un Shell de Render. No configures
`PORT`: Render lo proporciona automáticamente.

En Vercel configura:

```text
NEXT_PUBLIC_API_URL=https://<tu-backend>.onrender.com
```

Como el frontend y el backend viven en dominios distintos, el backend configura la cookie
de sesión como `SameSite=None; Secure` en producción. No quites `credentials: include` de las
peticiones del frontend.

### Si no llegan los correos en producción

Antes de desplegar, en Brevo:

1. Verifica el correo emisor en **Mis cuentas → Remitentes y dominios verificados** y pon esa
   misma dirección en `EMAIL_FROM` (no hace falta dominio propio).
2. Crea una clave de API con **Emails transaccionales → Todos** (permiso
   `transactional.email:write`); el resto de categorías puede quedar en *Ninguno*.
3. Copia la clave en `BREVO_API_KEY` en Render y reinicia el servicio.

El registro espera como máximo ~10 s al proveedor; si el envío falla, la cuenta se revierte y el
usuario recibe un mensaje para reintentar. En Render abre **Logs → Live tail** del servicio
`psicogestion-backend` (no los logs de build) y busca:

- `[correo] Transporte configurado: API HTTPS (Brevo)` al arrancar: confirma que se usa la API.
- `[correo] ... enviado ... messageId=...`: Brevo aceptó el mensaje; revisa entonces filtros,
  reglas y carpeta de spam del buzón destino.
- `[correo] Fallo al enviar ...` y `[error] POST /api/auth/registro ...`: incluyen `code`,
  `responseCode` y `response` sin exponer credenciales.

Diagnóstico según el log:

- `BREVO_401` / `HTTP 401`: clave inválida, revocada o sin permiso de correo transaccional.
- `BREVO_429` / `HTTP 429`: excediste la cuota diaria del plan gratuito (~300 correos/día).
- `code=BREVO_400` con `response=...`: revisa el mensaje: normalmente `EMAIL_FROM` no está
  verificado o el destinatario fue rechazado.
- `ETIMEDOUT` / `ECONNRESET` hacia `api.brevo.com`: problema de red; la API usa HTTPS/443, no SMTP.

El `build` de la raíz compila el workspace del frontend. Para el servicio backend de Render
se recomienda el Build Command anterior (`npm install`), ya que el backend es JavaScript y
no necesita compilación.

## Calidad y pruebas

```bash
npm test                    # pruebas del backend con SQLite en memoria
npm run test:backend        # equivalente explícito
npm run test:frontend       # pruebas del cliente HTTP del frontend
npm run test:e2e:install    # instala Chromium para Playwright (una vez)
npm run test:e2e            # humo en navegador y flujos autenticados opcionales
npm run test:e2e:perf       # medición de carga de /login
npm run build:client        # compilación de producción de Next.js
npm run lint
npm run format
npm run typecheck           # TypeScript del frontend
```

Las pruebas E2E levantan backend y frontend automáticamente. Las públicas corren sin configuración; para los flujos autenticados define `E2E_EMAIL` y `E2E_PASSWORD` con una cuenta verificada. El presupuesto de carga de `/login` se ajusta con `E2E_PERF_BUDGET_MS` (5000 ms por defecto).

Para ejecutar la misma suite backend contra PostgreSQL, crea una base de datos de pruebas y configura `TEST_DATABASE_URL` antes de ejecutar:

```bash
# PowerShell
$env:TEST_DATABASE_URL = "postgres://usuario:contraseña@localhost:5432/psicogestion_test"
npm run test:pg
```

`test:pg` falla explícitamente si `TEST_DATABASE_URL` no está configurada; no cambia ni elimina datos fuera de la base que proporciones.

La documentación de pruebas está organizada por iteración en [docs/pruebas/README.md](docs/pruebas/README.md).

## Funcionalidades actuales

- Registro, verificación de correo, inicio/cierre de sesión y recuperación de contraseña.
- Autenticación por cookie httpOnly, consulta de sesión, acceso por correo/teléfono y tema claro/oscuro.
- Administración de usuarios, pacientes y terapeutas, con validaciones y controles de acceso.
- Gestión de salas, disponibilidad y agenda de citas con prevención de traslapes.
- Notificaciones por correo y registros de auditoría con vista paginada exclusiva para administración.
- Derechos ARCO: exportación JSON de expedientes auditada y anonimización que conserva citas, bloquea el expediente y elimina datos identificables relacionados.
- Administración de correos autorizados y roles; cambiar el rol invalida las sesiones anteriores del usuario.
- Aviso de privacidad público versionado y acciones de exportación/anonimización protegidas en el frontend.

Las rutas REST se encuentran bajo `/api`; el endpoint de salud es `GET /health`.

## Estructura

```text
src/                 Backend Express
tests/               Pruebas backend (Jest)
migrations/           Migraciones de base de datos
scripts/              Herramientas de desarrollo y migraciones
front/                Frontend Next.js (workspace npm)
docs/                 Progreso, bloqueos, riesgos y decisiones
docs/pruebas/         Documentación de pruebas por iteración
```

La estructura del monorepo y la elección de npm se documentan en [docs/ADR/0001-estructura-monorepo.md](docs/ADR/0001-estructura-monorepo.md).
