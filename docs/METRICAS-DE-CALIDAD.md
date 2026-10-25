# Métricas de calidad

Fecha de medición: 25 de octubre de 2026. Los resultados describen el estado comprobado del árbol de trabajo, no una garantía de producción.

## Resumen

| Área                                                   |         Umbral / objetivo |                          Resultado | Estado                     |
| ------------------------------------------------------ | ------------------------: | ---------------------------------: | -------------------------- |
| Backend, statements                                    |                      ≥85% |                             93.66% | Cumple                     |
| Backend, líneas                                        |                      ≥85% |                             94.18% | Cumple                     |
| Frontend, statements y líneas                          |                      ≥70% |                             31.03% | **No cumple**              |
| Lógica crítica backend, statements y líneas            |                      ≥95% |                         95.34–100% | Cumple                     |
| Agenda con 42 citas, render por debajo del presupuesto |        <500 ms por render |                    Prueba aprobada | Cumple                     |
| axe-core en `/privacidad` de producción                | 0 violaciones WCAG 2.1 AA | 0 violaciones; 31 reglas aprobadas | Cumple en la ruta evaluada |

## Cobertura

Se midió el backend con `npm run test:backend:coverage` y Jest en serie. Se incluyó `src/**/*.js` y se excluyó el archivo de arranque `src/server.js`.

| Suite / archivo                      | Statements | Líneas |  Ramas |
| ------------------------------------ | ---------: | -----: | -----: |
| Backend completo                     |     93.66% | 94.18% | 79.00% |
| `src/lib/curp.js`                    |     95.34% |   100% | 89.65% |
| `src/lib/slots.js`                   |       100% |   100% |   100% |
| `src/modules/citas/citas.service.js` |     98.22% | 98.31% | 92.30% |

Las tres áreas críticas superan 95% en statements y líneas. La cobertura de ramas de CURP y del servicio de citas es menor a 95%; no se debe interpretar el umbral configurado como cobertura de ramas.

La cobertura del frontend se calculó con V8 sobre `app/`, `components/` y `lib/`. `npm run test:frontend:coverage` excluye únicamente el benchmark `agenda-page.test.tsx`, porque instrumentar el código altera la latencia que esa prueba mide; el benchmark sí se ejecuta y pasa en `npm run test:frontend`. El resultado de cobertura fue:

- Statements y líneas: **31.03%** (1,600 de 5,156).
- Funciones: 55.71%.
- Ramas: 73.58%.
- La suite de cobertura ejecutó 21 pruebas; la suite frontend normal pasó sus 22 pruebas.

El porcentaje frontend no alcanza el objetivo de 70%. La mayor parte de la brecha corresponde a páginas de agenda, citas, salas, terapeutas y autenticación que todavía no cuentan con pruebas de interacción suficientes. No se excluyeron esas páginas del denominador para aparentar el cumplimiento.

## Autorización

`tests/router.authorization.test.js` recorre dinámicamente las rutas de los ocho routers clínicos/administrativos montados, verifica que sin sesión y con token inválido respondan 401 y valida 403 para secretaria en rutas exclusivas de administración, bitácora, anonimización y reactivación. La suite backend completa aprobó.

## Accesibilidad

- Dos comprobaciones axe-core con jsdom cubren el aviso público y el formulario de paciente. jsdom no implementa `canvas`; por eso el contraste se desactiva únicamente en esas comprobaciones unitarias.
- Se ejecutó axe-core en el navegador sobre el build de producción de `/privacidad`, incluyendo color y contraste. Resultado: **0 violaciones, 31 reglas aprobadas y 0 comprobaciones incompletas**.
- Este resultado se limita a la ruta pública auditada. Las páginas clínicas protegidas requieren una auditoría visual y de teclado con una sesión de prueba para confirmar el cumplimiento de toda la aplicación.

## Rendimiento y bundles

- La prueba `front/app/(app)/agenda/agenda-page.test.tsx` renderiza 42 citas, verifica accesibilidad por teclado y exige que cada render medido sea inferior a 500 ms. Pasó fuera de la instrumentación de cobertura.
- Build Webpack de producción: correcto; Next.js generó 18 rutas estáticas.
- Chunks JavaScript de `.next/static/chunks`: **1,252,594 bytes** sin comprimir para todo el sitio.
- Runtime compartido (`rootMainFiles` del manifiesto): **445,755 bytes** sin comprimir. El chunk de página más grande es terapeutas, con **24,094 bytes**; el shell del grupo clínico agrega 9,130 bytes. Son tamaños de build sin gzip/Brotli y no reemplazan una medición de red en producción.
- No se estableció un presupuesto máximo de bundle ni un umbral de Core Web Vitals; deben acordarse antes de convertir estas cifras en puertas de release.

## Análisis estático y complejidad

- `npm run lint`: terminado sin errores ni advertencias.
- `npm run typecheck`: terminado sin errores.
- El análisis de complejidad con límite de referencia 10 encontró seis funciones por encima de ese valor; la mayor tiene complejidad ciclomática 21 (`disponibilidad`, citas). Las funciones se documentan para refactorización priorizada, pero no se cambiaron en esta fase para evitar alterar lógica clínica fuera de las pruebas actuales.
- `git diff --check`: sin errores de whitespace.

## Comandos de verificación

```text
npm run test:backend:coverage
npm run test:frontend
npm run test:frontend:coverage
npm run build:client
npm run lint
npm run typecheck
```
