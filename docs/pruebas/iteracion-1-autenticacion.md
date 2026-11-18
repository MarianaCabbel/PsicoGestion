# Iteración 1 — Autenticación (`CP1-INT-01`…`CP1-INT-29`)

## Alcance

Registro de usuario del sistema, verificación de correo, inicio de sesión por correo o teléfono, recuperación y restablecimiento de contraseña, y cierre de sesión. Incluye formato y unicidad de campos, mensajes genéricos ante credenciales inválidas, expiración de códigos y enlaces, e invalidación de sesiones. Quedan fuera pacientes, terapeutas, salas, citas y agenda.

## Catálogo de casos

| ID | Caso | Suite principal | Estado |
| -- | ---- | --------------- | ------ |
| CP1-INT-01 | Registro exitoso con datos válidos | `auth.registro.test.js`, `auth.integration.test.js` | Cubierto |
| CP1-INT-02 | Nombre vacío o mayor a 50 caracteres | `auth.registro.test.js` | Cubierto |
| CP1-INT-03 | Teléfono ya registrado | `auth.registro.test.js` | Cubierto |
| CP1-INT-04 | Teléfono con formato incorrecto | `auth.registro.test.js` | Cubierto |
| CP1-INT-05 | Correo institucional ya registrado | `auth.registro.test.js` | Cubierto |
| CP1-INT-06 | Correo institucional con formato incorrecto | `auth.registro.test.js` | Cubierto |
| CP1-INT-07 | Código de verificación inválido | `auth.verificar.test.js` | Cubierto |
| CP1-INT-08 | Código de verificación expirado y reenvío | `auth.verificar.test.js` | Cubierto |
| CP1-INT-09 | Contraseña con formato inválido | `auth.registro.test.js` | Cubierto |
| CP1-INT-10 | Contraseñas no coinciden | `auth.registro.test.js` | Cubierto |
| CP1-INT-11 | Inicio de sesión con correo y contraseña correctos | `auth.login.test.js`, `auth.integration.test.js` | Cubierto |
| CP1-INT-12 | Inicio de sesión con teléfono y contraseña correctos | `auth.login-telefono.test.js` | Cubierto |
| CP1-INT-13 | Correo no registrado (mensaje genérico) | `auth.login.test.js` | Cubierto |
| CP1-INT-14 | Teléfono no registrado (mensaje genérico) | `auth.login-telefono.test.js` | Cubierto |
| CP1-INT-15 | Correo correcto, contraseña incorrecta (mensaje genérico) | `auth.login.test.js` | Cubierto |
| CP1-INT-16 | Teléfono correcto, contraseña incorrecta (mensaje genérico) | `auth.login-telefono.test.js` | Cubierto |
| CP1-INT-17 | Campo correo vacío | `auth.login.test.js` | Cubierto |
| CP1-INT-18 | Campo teléfono vacío | `auth.login-telefono.test.js` | Cubierto |
| CP1-INT-19 | Campo contraseña vacío | `auth.login.test.js`, `auth.login-telefono.test.js` | Cubierto |
| CP1-INT-20 | Inicio de sesión con correo sin verificar | `auth.login.test.js`, `auth.integration.test.js` | Cubierto |
| CP1-INT-21 | Cerrar sesión exitosamente | `auth.logout.test.js`; interfaz en `protected-layout.cp4.test.tsx` (`CP4-INT-34`) | Cubierto |
| CP1-INT-22 | Cancelar cierre de sesión | Sin prueba explícita; diálogo cubierto en `CP4-INT-31` | Sin cobertura explícita |
| CP1-INT-23 | Cierre de sesión con acción en curso | Sin suite identificada | Sin cobertura |
| CP1-INT-24 | Recuperación con correo registrado | `auth.recuperar.test.js`, `auth.integration.test.js` | Cubierto |
| CP1-INT-25 | Recuperación con correo de formato inválido | `auth.recuperar.test.js` | Cubierto |
| CP1-INT-26 | Recuperación con correo no registrado (misma respuesta) | `auth.recuperar.test.js` | Cubierto |
| CP1-INT-27 | Caducidad del enlace de restablecimiento (10 min) | `auth.restablecer.test.js` | Cubierto |
| CP1-INT-28 | Restablecimiento exitoso y contraseña cifrada | `auth.restablecer.test.js` | Cubierto |
| CP1-INT-29 | Contraseña inválida al restablecer | `auth.restablecer.test.js` | Cubierto |

Suites relacionadas sin ID CP1 propio: `auth.seguridad.test.js`, `auth.ratelimit.test.js`, `auth.validation.test.js`, `middleware.test.js`, `front/lib/auth-validation.test.ts`, `front/components/app/auth-guard.test.tsx`, `e2e/publico.spec.ts`. Se documentan en [transversal.md](transversal.md).

## Ejecución registrada

- **Entorno:** SQLite en memoria; PostgreSQL opcional con `TEST_DATABASE_URL`.
- **Comandos:** `npm run test:backend`, `npm run test:backend:coverage`, `npm run test:frontend`, `npm run test:e2e`.
- **Resultado global:** backend 25 suites, 428/428 pruebas; frontend 22 archivos, 83/83; E2E público 3/3 (`PT-01`, `PT-05`, `PT-14` en el plan de pruebas).
- **Fecha de medición:** 25 de octubre de 2026.

## Evidencia

- [Plan de pruebas](../PLAN-DE-PRUEBAS.md): PT-01, PT-02, PT-05, PT-06, PT-07, PT-15.
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md): sesión requerida, roles y autorización.
- [Métricas de calidad](../METRICAS-DE-CALIDAD.md): cobertura backend y axe en `/privacidad`.

## Pendientes

- CP1-INT-22: añadir prueba de cancelación del diálogo de cierre de sesión.
- CP1-INT-23: definir y probar el comportamiento ante acciones en curso.
- Completar axe y teclado en rutas protegidas con roles secretaria y administrador.
