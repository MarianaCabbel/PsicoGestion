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

## Calidad y pruebas

```bash
npm test                    # pruebas del backend con SQLite en memoria
npm run test:backend        # equivalente explícito
npm run test:frontend       # pruebas del cliente HTTP del frontend
npm run build:client        # compilación de producción de Next.js
npm run lint
npm run format
npm run typecheck           # TypeScript del frontend
```

Para ejecutar la misma suite backend contra PostgreSQL, crea una base de datos de pruebas y configura `TEST_DATABASE_URL` antes de ejecutar:

```bash
# PowerShell
$env:TEST_DATABASE_URL = "postgres://usuario:contraseña@localhost:5432/psicogestion_test"
npm run test:pg
```

`test:pg` falla explícitamente si `TEST_DATABASE_URL` no está configurada; no cambia ni elimina datos fuera de la base que proporciones.

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
```

La estructura del monorepo y la elección de npm se documentan en [docs/ADR/0001-estructura-monorepo.md](docs/ADR/0001-estructura-monorepo.md).
