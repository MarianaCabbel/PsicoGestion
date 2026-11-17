# Matriz de trazabilidad

| Requisito                                          | Implementación / suite                                                      | Evidencia de verificación                                                     | Estado                        |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| Cobertura backend ≥85%                             | Jest; `jest.config.cjs`                                                     | 93.66% statements, 94.18% líneas                                              | Cumple                        |
| Lógica crítica ≥95%                                | `src/lib/curp.js`, `src/lib/slots.js`, `src/modules/citas/citas.service.js` | Statements/líneas: 95.34/100%, 100/100%, 98.22/98.31%                         | Cumple                        |
| Cobertura frontend ≥70%                            | Vitest V8; `front/vitest.config.ts`                                         | Statements/líneas globales 31.03%                                             | **Pendiente**                 |
| Sesión requerida en rutas privadas                 | `tests/router.authorization.test.js`                                        | Rutas registradas reciben 401 sin token y token inválido                      | Cumple                        |
| Rol requerido para administración                  | `tests/router.authorization.test.js`, `tests/privacidad.admin.test.js`      | Secretaria recibe 403 en endpoints restringidos                               | Cumple                        |
| ARCO: exportar y anonimizar                        | `tests/privacidad.admin.test.js`, `patient-arco.test.tsx`                   | Exportación, anonimización y confirmación doble                               | Cumple                        |
| Accesibilidad WCAG 2.1 AA                          | `front/test/accessibility.test.tsx` y axe en navegador                      | 0 violaciones en `/privacidad`; resto de rutas requiere auditoría             | Parcial                       |
| Agenda renderiza múltiples citas y permite teclado | `agenda-page.test.tsx`                                                      | 42 citas; pasa límite de 500 ms por render                                    | Cumple en benchmark           |
| Build optimizado y bundles                         | Next.js Webpack                                                             | Build aprobado; chunks totales 1,252,594 bytes sin comprimir                  | Medido; presupuesto pendiente |
| Lint y tipos                                       | ESLint y TypeScript                                                         | `npm run lint` y `npm run typecheck` sin errores                              | Cumple                        |
| Complejidad ciclomática                            | Análisis ESLint con límite de referencia 10                                 | Seis funciones superiores al límite; máximo 21                                | Seguimiento pendiente         |
| Compatibilidad PostgreSQL                          | `scripts/test-postgres.js`                                                  | Requiere base externa `TEST_DATABASE_URL`; no ejecutada                       | Pendiente                     |
| Edición de salas                                   | `PUT /api/salas/:id`; `tests/salas.test.js` (CP-INT-102/104)                | Nombre validado y único; 409 por duplicado; auditoría y roles                 | Cumple                        |
| Baja de salas                                      | `salas.service.js` (`darDeBaja`); `tests/salas.test.js` (CP-INT-96/97)      | Solo bloquea con citas pendientes o en curso; la baja es lógica y auditada    | Cumple                        |
| Errores de red al guardar salas                    | `salas.service.js` (503); `front/lib/api.ts`; `salas-page.test.tsx`         | Conserva el nombre, muestra error accionable y permite reintentar             | Cumple                        |
| Día disponible vs. reservado (CP3-51/52/53)        | `salas.service.js` (`estado_dia`, `estado`, `nivel`); `tests/salas.test.js` | Día binario; nivel visual parcial/completa; pruebas CP-INT-99/100/105/106/107 | Cumple                        |
| Edición de cita con estatus y confirmación         | `appointment-wizard.tsx`; `appointment-wizard.test.tsx`                     | Muestra el estatus actual, pide confirmación y conserva valores               | Cumple                        |
| Enlace directo por folio                           | `citas/page.tsx`; `citas-page.test.tsx`                                     | `/citas?folio=` carga el detalle sin listar todas las citas                   | Cumple                        |
| Refresco inmediato entre vistas                    | `front/lib/citas-events.ts`; `citas/page.tsx`; `agenda/page.tsx`            | Crear o cancelar una cita refresca la agenda en otra pestaña                  | Cumple                        |
| Humo y rendimiento en navegador                    | `e2e/publico.spec.ts`; `playwright.config.ts`                               | `/login` visible en <1 s local (presupuesto 5 s); 3/3 pruebas públicas        | Cumple                        |

## CP4-INT: agenda, impresión y navegación

Criterios de integración cubiertos en backend (`tests/agenda.cp4.test.js`), frontend (`front/**/*cp4.test.*`) y navegador (`e2e/agenda-cp4.spec.ts`, con datos de `npm run seed:e2e`).

| Criterio CP4-INT                                        | Evidencia                                                                                                                             | Estado |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 01, 03, 15 — vista diaria y fecha solicitada            | Backend 01/03 y 15; frontend `agenda-cp4.test.tsx`; E2E “día, semana y mes”                                                            | Cumple |
| 02 — agenda vacía sin errores                           | Backend 02; E2E “agenda vacía”                                                                                                        | Cumple |
| 04 — semana de lunes a domingo                          | Backend 04; frontend 04; E2E navegación de vistas                                                                                     | Cumple |
| 05, 09 — mes completo y total por día                   | Backend 05/09; frontend 09; E2E “mes indica el total por día”                                                                         | Cumple |
| 06, 21 — 24 citas en <2 s y render en <3 s              | Backend 06; frontend 06/21; E2E `@perf` de agenda                                                                                     | Cumple |
| 07, 08, 11, 12, 13 — simultáneas en carriles y detalle  | Backend 07/08; frontend `agenda-layout.test.ts`; E2E “simultáneas en carriles”                                                        | Cumple |
| 10, 17, 18, 19, 20 — 24 lapsos, ocupación y duración    | Backend 10 y 18/20 y 19; frontend 17/18/19/20; E2E “24 lapsos”                                                                        | Cumple |
| 14 — cita vencida por color y leyenda                   | Backend 14; frontend `agenda-cp4.test.tsx`; E2E “distingue la cita vencida”                                                           | Cumple |
| 16 — fechas inválidas o imposibles                      | Backend 16; frontend 16; E2E “rechaza fechas inválidas”                                                                               | Cumple |
| 22, 25, 26, 27 — impresión diaria, privacidad y <5 s    | Frontend `print-cp4.test.tsx`; E2E “imprime el día”                                                                                   | Cumple |
| 23, 24 — impresión semanal como listado y mensual       | Frontend `print-cp4.test.tsx`; E2E “imprime la semana y el mes”                                                                       | Cumple |
| 28 — inicio muestra la agenda y sus indicadores         | Frontend `panel-cp4.test.tsx`; E2E “el inicio muestra la agenda”                                                                      | Cumple |
| 29, 30, 35 — navegación, sesión y menú móvil            | Frontend `protected-layout.cp4.test.tsx`; E2E “navegación, sesión y menú móvil”                                                       | Cumple |
| 31, 34 — confirmación al cerrar sesión                  | Frontend `protected-layout.cp4.test.tsx`; E2E “pide confirmación y cierra la sesión”                                                  | Cumple |
| 32, 33 — filtros por terapeuta y sala                   | Backend “filtra por terapeuta y por sala”; E2E “filtra por terapeuta y por sala”                                                      | Cumple |
| Cancelar libera el lapso y refresca otras vistas        | Backend “cita cancelada no aparece”; E2E “refresca la agenda al cancelar”                                                              | Cumple |
