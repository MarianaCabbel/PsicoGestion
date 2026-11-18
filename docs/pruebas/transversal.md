# Transversal — Migraciones, auditoría, notificaciones y cierre de calidad

## Alcance

Casos que acompañan a todas las iteraciones: migraciones y esquema, seguridad y permisos, auditoría y privacidad (ARCO), notificaciones y cierre de calidad (Fase 6). No sustituyen a los documentos de iteración; los complementan.

## Migraciones y esquema — `CP-INT-85`…`CP-INT-87`

| ID | Caso | Evidencia | Estado |
| -- | ---- | --------- | ------ |
| 85 | Aplicar migraciones produce el mismo esquema que los modelos | `tests/migraciones.test.js` | Cumple |
| 85 | Migraciones reversibles por completo | `tests/migraciones.test.js` | Cumple |
| 86 | Ejecutar `up` dos veces no repite migraciones | `tests/migraciones.test.js` | Cumple |
| 86 | Actualizar una base anterior sin perder usuarios | `tests/migraciones.test.js` | Cumple |
| 87 | El esquema impide CURP duplicada y llaves foráneas huérfanas | `tests/migraciones.test.js` | Cumple |

## Seguridad, roles y permisos

| ID | Caso | Evidencia | Estado |
| -- | ---- | --------- | ------ |
| `CP-UNI-33` | `JWT_SECRET` obligatorio y de al menos 32 caracteres en producción | `tests/auth.seguridad.test.js` | Cumple |
| `CP-UNI-34`…`CP-UNI-39` | Permisos por rol, validación Zod, errores por campo, reglas de baja, paginación y escape HTML | `tests/middleware.test.js` | Cumple |
| `CP-INT-70`…`CP-INT-79` | Hash del token, invalidación de JWT, bloqueo de códigos, lista blanca, cookie httpOnly, CORS, cabeceras y autenticación de rutas | `tests/auth.seguridad.test.js` | Cumple |
| `CP-INT-80`…`CP-INT-84` | Límites de intentos de login, recuperación y registro por cuenta/red | `tests/auth.ratelimit.test.js` | Cumple |
| — | Sesión ausente o inválida → 401; rol insuficiente → 403 | `tests/router.authorization.test.js` | Cumple |

## Auditoría y privacidad (Fase 5)

| Caso | Evidencia | Estado |
| ---- | --------- | ------ |
| Exportación ARCO auditada | `tests/privacidad.admin.test.js`, `patient-arco.test.tsx` | Cumple |
| Anonimización conserva citas y elimina datos identificables | `tests/privacidad.admin.test.js` | Cumple |
| Doble confirmación en el frontend | `patient-arco.test.tsx`, `patient-privacy.test.tsx` | Cumple |
| Bitácora paginada y filtrable solo para administración | `tests/privacidad.admin.test.js`, `admin-pages.test.tsx` | Cumple |
| Cambiar rol invalida sesiones anteriores | `tests/router.authorization.test.js` | Cumple |
| Aviso de privacidad público y versionado | `front/app/privacidad/page.test.tsx` | Cumple |

## Notificaciones

| ID | Caso | Evidencia | Estado |
| -- | ---- | --------- | ------ |
| 190 | Agendar encola la confirmación sin enviarla en la petición | `tests/notificaciones.test.js` | Cumple |
| 191 | Caída del SMTP no impide agendar | `tests/notificaciones.test.js` | Cumple |
| 192 | Worker envía la confirmación, no la repite y el detalle refleja el estado | `tests/notificaciones.test.js` | Cumple |
| 193 | Modificar y cancelar generan avisos propios | `tests/notificaciones.test.js` | Cumple |
| 194 | Dos workers simultáneos no envían el mismo correo dos veces | `tests/notificaciones.test.js` | Cumple |
| 195 | Reintento con espera de 1 minuto y envío al restablecerse SMTP | `tests/notificaciones.test.js` | Cumple |
| 196 | Tras 5 intentos fallidos queda fallida con espera 1, 5, 15 y 60 min | `tests/notificaciones.test.js` | Cumple |
| 197 | El error guardado no conserva direcciones de correo | `tests/notificaciones.test.js` | Cumple |
| 198 | Un registro `procesando` abandonado se recupera; uno reciente no se toca | `tests/notificaciones.test.js` | Cumple |
| 200 | Reencolar confirmación; no aplica a canceladas, vencidas ni sin correo | `tests/notificaciones.test.js` | Cumple |
| 201 | El worker envía pendientes en cada intervalo y sigue tras un error | `tests/notificaciones.test.js` | Cumple |

## Cierre de calidad (Fase 6)

| Métrica | Objetivo | Resultado registrado | Estado |
| ------- | -------- | -------------------- | ------ |
| Cobertura backend | ≥85% statements y líneas | 93.66% / 94.18% | Cumple |
| Lógica crítica | ≥95% statements y líneas | 95.34%…100% | Cumple |
| Cobertura frontend | ≥70% statements y líneas | 31.03% | **No cumple** |
| Axe en navegador | 0 violaciones WCAG 2.1 AA | 0 violaciones; 31 reglas en `/privacidad` | Cumple en la ruta evaluada |
| Lint y typecheck | Sin errores | Aprobado | Cumple |
| PostgreSQL | Suite con `TEST_DATABASE_URL` | No ejecutado | Pendiente |
| Bundle y Core Web Vitals | Objetivos por acordar | Sin presupuesto definido | Pendiente |

## Ejecución registrada

- **Comandos:** `npm run test:backend`, `npm run test:backend:coverage`, `npm run test:frontend`, `npm run test:e2e`, `npm run build:client`, `npm run lint`, `npm run typecheck`.
- **Fecha de medición:** 25 de octubre de 2026.

## Pendientes críticos

- Elevar la cobertura global del frontend al 70%.
- Completar axe y teclado en rutas protegidas con roles secretaria y administrador.
- Definir presupuesto de bundle y objetivos de Core Web Vitals.
- Ejecutar PostgreSQL con una base de pruebas aislada.
- Repetir la medición de carga en un entorno representativo.
- Regenerar `npm run seed:e2e` en CI antes de la suite CP4-INT.
- Validar la configuración real de producción (base de datos, SMTP, orígenes, TLS y secretos).
