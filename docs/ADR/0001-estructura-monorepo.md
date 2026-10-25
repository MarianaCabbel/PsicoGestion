# ADR 0001: Estructura del monorepo y npm

- **Estado:** Aceptada
- **Fecha:** 2026-10-20
- **Requisito de ejecución:** Node.js 20.19+, 22.13+ o 24+, y npm 7 o superior.

## Contexto

El backend Express y el frontend Next.js se mantienen en un mismo repositorio. El backend vive en la raíz (`src/`, `tests/`, `migrations/`), mientras que la aplicación web vive en `front/`. Antes de esta decisión, la raíz utilizaba `package-lock.json`, pero la configuración del frontend declaraba pnpm y coexistían archivos de lock/configuración de pnpm.

## Decisión

- Mantener un solo repositorio con la raíz como paquete del backend y `front/` como workspace npm.
- Usar npm workspaces declarados en el `package.json` raíz y un solo `package-lock.json` en la raíz.
- Ejecutar scripts del frontend desde la raíz mediante `npm run <script> --workspace front`.
- Mantener las pruebas backend en el paquete raíz; la suite utiliza SQLite en memoria por defecto y puede apuntar a PostgreSQL mediante `TEST_DATABASE_URL`.
- No conservar archivos de lock o configuración de pnpm.

## Consecuencias

- Una instalación desde la raíz prepara las dependencias del backend y frontend con `npm install`.
- El lockfile central registra el árbol de dependencias del monorepo.
- Los comandos de CI y desarrollo usan npm de forma consistente.
- Las dependencias de servicios externos, como PostgreSQL y SMTP, siguen configurándose por entorno y no se incluyen en el repositorio.
