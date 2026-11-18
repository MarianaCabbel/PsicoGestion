# Iteración 4 — Agenda, interfaz y no funcionales (`CP4-INT-01`…`CP4-INT-35`)

## Alcance

Vista de agenda en día, semana y mes; impresión diaria, semanal y mensual; página de inicio con indicadores; navegación, sesión y menú móvil; interfaz general (tema, componentes y accesibilidad); y pruebas no funcionales de rendimiento, bundle y calidad estática. Los `CP4-INT-xx` se conservan sin renombrar.

## Catálogo `CP4-INT-xx`

Los 35 criterios se verifican en backend (`tests/agenda.cp4.test.js`), frontend (`agenda-cp4.test.tsx`, `print-cp4.test.tsx`, `panel-cp4.test.tsx`, `protected-layout.cp4.test.tsx`, `agenda-layout.test.ts`) y navegador (`e2e/agenda-cp4.spec.ts`, con datos de `npm run seed:e2e`). La tabla sigue el agrupamiento de la [matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md).

| Criterio | Caso | Evidencia | Estado |
| -------- | ---- | --------- | ------ |
| 01, 03, 15 | Vista diaria y fecha solicitada | Backend 01/03/15; `agenda-cp4.test.tsx`; E2E “día, semana y mes” | Cubierto |
| 02 | Agenda vacía sin errores | Backend 02; E2E “agenda vacía” | Cubierto |
| 04 | Semana de lunes a domingo | Backend 04; frontend 04; E2E navegación de vistas | Cubierto |
| 05, 09 | Mes completo y total por día | Backend 05/09; frontend 09; E2E “mes indica el total por día” | Cubierto |
| 06, 21 | 24 citas en <2 s y horarios en <3 s | Backend 06; frontend 06/21; E2E `@perf` de agenda | Cubierto |
| 07, 08, 11, 12, 13 | Simultáneas en carriles y detalle | Backend 07/08; `agenda-layout.test.ts`; E2E “simultáneas en carriles” | Cubierto |
| 10, 17, 18, 19, 20 | 24 lapsos, ocupación y duración | Backend 10/18/20/19; frontend 17…20; E2E “24 lapsos” | Cubierto |
| 14 | Cita vencida por color y leyenda | Backend 14; `agenda-cp4.test.tsx`; E2E “distingue la cita vencida” | Cubierto |
| 16 | Fechas inválidas o imposibles | Backend 16; frontend 16; E2E “rechaza fechas inválidas” | Cubierto |
| 22, 25, 26, 27 | Impresión diaria, privacidad y <5 s | `print-cp4.test.tsx`; E2E “imprime el día” | Cubierto |
| 23, 24 | Impresión semanal como listado y mensual | `print-cp4.test.tsx`; E2E “imprime la semana y el mes” | Cubierto |
| 28 | Inicio muestra la agenda y sus indicadores | `panel-cp4.test.tsx`; E2E “el inicio muestra la agenda” | Cubierto |
| 29, 30, 35 | Navegación, sesión y menú móvil | `protected-layout.cp4.test.tsx`; E2E “navegación, sesión y menú móvil” | Cubierto |
| 31, 34 | Confirmación al cerrar sesión | `protected-layout.cp4.test.tsx`; E2E “pide confirmación y cierra la sesión” | Cubierto |
| 32, 33 | Filtros por terapeuta y sala | Backend “filtra por terapeuta y por sala”; E2E equivalente | Cubierto |
| Cancelar | Libera el lapso y refresca otras vistas | Backend “cita cancelada no aparece”; E2E “refresca la agenda al cancelar” | Cubierto |

## Pruebas no funcionales de la iteración 4

| Métrica | Objetivo | Resultado registrado | Estado | Fuente |
| ------- | -------- | -------------------- | ------ | ------ |
| Render de agenda con 42 citas | <500 ms por render | Prueba aprobada | Cumple | `agenda-page.test.tsx` |
| axe-core en `/privacidad` | 0 violaciones WCAG 2.1 AA | 0 violaciones; 31 reglas | Cumple | `METRICAS-DE-CALIDAD.md` |
| `npm run build:client` | Build y rutas correctos | Aprobado; 18 rutas estáticas | Cumple | `PLAN-DE-PRUEBAS.md` |
| `npm run lint` y `npm run typecheck` | Sin errores | Aprobado | Cumple | `METRICAS-DE-CALIDAD.md` |
| Cobertura backend | ≥85% statements y líneas | 93.66% / 94.18% | Cumple | `METRICAS-DE-CALIDAD.md` |
| Chunks JavaScript | Presupuesto por definir | 1,252,594 bytes sin comprimir | Pendiente | `METRICAS-DE-CALIDAD.md` |
| Complejidad ciclomática | Referencia 10 | 6 funciones por encima; máximo 21 | Seguimiento | `METRICAS-DE-CALIDAD.md` |
| Humo E2E en navegador | Redirección y flujos autenticados | Aprobado (15/15 criteria CP4-INT) | Cumple | `PLAN-DE-PRUEBAS.md` PT-14, PT-16 |
| Carga de `/login` | ≤5 s (`E2E_PERF_BUDGET_MS`) | <1 s local | Cumple | `PLAN-DE-PRUEBAS.md` PT-15 |
| Cobertura frontend | ≥70% statements y líneas | 31.03% | **No cumple** | `METRICAS-DE-CALIDAD.md` |

## Ejecución registrada

- **Entorno:** SQLite en memoria y Chromium (Playwright); medición de axe sobre build de producción.
- **Comandos:** `npm run test:backend`, `npm run test:frontend`, `npm run test:e2e`, `npm run test:e2e:perf`, `npm run build:client`, `npm run lint`, `npm run typecheck`.
- **Datos E2E:** `npm run seed:e2e` crea el usuario `e2e@correo.uady.mx` y datos `E2E-*` aislados; `e2e/seed-data.json` es el manifiesto ignorado por git.
- **Fecha de medición:** 25 de octubre de 2026.

## Evidencia

- [Plan de pruebas](../PLAN-DE-PRUEBAS.md): PT-09, PT-10, PT-11, PT-14, PT-15, PT-16 y criterios de cierre.
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md): sección CP4-INT.
- [Métricas de calidad](../METRICAS-DE-CALIDAD.md): rendimiento, bundles y accesibilidad.

## Pendientes

- Definir presupuesto de bundle y objetivos de Core Web Vitals (LCP, INP, CLS).
- Repetir `npm run test:e2e:perf` en un entorno representativo antes de fijar el presupuesto.
- Regenerar `npm run seed:e2e` en CI antes de la suite CP4-INT o fijar credenciales verificadas equivalentes.
