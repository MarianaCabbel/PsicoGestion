# Equivalencia de identificadores de pruebas

Los casos definidos por iteración usan `CP1-INT-xx`, `CP2-xx`, `CP3-xx` y `CP4-INT-xx`. En el código las suites conservan los identificadores históricos `CP-UNI-xx` y `CP-INT-xx`. Esta tabla los relaciona; **no se renombraron títulos de pruebas**.

## Iteración 1 — `CP1-INT-xx` ↔ `CP-UNI-xx`

El catálogo de la iteración 1 coincide con la numeración `CP-UNI-01`…`CP-UNI-21` y `CP-UNI-24`…`CP-UNI-29` (no existen `CP-UNI-22` ni `CP-UNI-23` en el repositorio).

| CP1-INT-xx | Id. histórico | Suite |
| ---------- | ------------- | ----- |
| 01 | CP-UNI-01 | `tests/auth.registro.test.js` |
| 02 | CP-UNI-02 | `tests/auth.registro.test.js` |
| 03 | CP-UNI-03 | `tests/auth.registro.test.js` |
| 04 | CP-UNI-04 | `tests/auth.registro.test.js` |
| 05 | CP-UNI-05 | `tests/auth.registro.test.js` |
| 06 | CP-UNI-06 | `tests/auth.registro.test.js` |
| 07 | CP-UNI-07 | `tests/auth.verificar.test.js` |
| 08 | CP-UNI-08 | `tests/auth.verificar.test.js` |
| 09 | CP-UNI-09 | `tests/auth.registro.test.js` |
| 10 | CP-UNI-10 | `tests/auth.registro.test.js` |
| 11 | CP-UNI-11 | `tests/auth.login.test.js` |
| 12 | CP-UNI-12 | `tests/auth.login-telefono.test.js` |
| 13 | CP-UNI-13 | `tests/auth.login.test.js` |
| 14 | CP-UNI-14 | `tests/auth.login-telefono.test.js` |
| 15 | CP-UNI-15 | `tests/auth.login.test.js` |
| 16 | CP-UNI-16 | `tests/auth.login-telefono.test.js` |
| 17 | CP-UNI-17 | `tests/auth.login.test.js` |
| 18 | CP-UNI-18 | `tests/auth.login-telefono.test.js` |
| 19 | CP-UNI-19 | `tests/auth.login.test.js` |
| 20 | CP-UNI-20 | `tests/auth.login.test.js` |
| 21 | CP-UNI-21 | `tests/auth.logout.test.js`; cierre desde interfaz en `CP4-INT-34` |
| 22 | Sin id. histórico | Cobertura indirecta del diálogo en `CP4-INT-31`; sin prueba explícita de cancelación |
| 23 | Sin id. histórico | Sin cobertura |
| 24 | CP-UNI-24 | `tests/auth.recuperar.test.js` |
| 25 | CP-UNI-25 | `tests/auth.recuperar.test.js` |
| 26 | CP-UNI-26 | `tests/auth.recuperar.test.js` |
| 27 | CP-UNI-27 | `tests/auth.restablecer.test.js` |
| 28 | CP-UNI-28 | `tests/auth.restablecer.test.js` |
| 29 | CP-UNI-29 | `tests/auth.restablecer.test.js` |

## Iteración 2 — `CP2-xx` ↔ `CP-INT-xx`

Los `CP2-xx` aparecen entre paréntesis dentro de los títulos de `tests/pacientes.test.js` y `tests/terapeutas.test.js`.

| CP2-xx | Id. histórico | Suite |
| ------ | ------------- | ----- |
| 02 | CP-INT-64 | `tests/terapeutas.test.js` |
| 03 | CP-INT-64 | `tests/terapeutas.test.js` |
| 05 | CP-INT-64 | `tests/terapeutas.test.js` |
| 10 | CP-INT-65 | `tests/terapeutas.test.js` |
| 12 | CP-INT-65 | `tests/terapeutas.test.js` |
| 13 | CP-INT-65 | `tests/terapeutas.test.js` |
| 15 | CP-INT-66 | `tests/terapeutas.test.js` |
| 17 | CP-INT-46 | `tests/pacientes.test.js` |
| 25 | CP-INT-47 | `tests/pacientes.test.js` |
| 28 | CP-INT-47 | `tests/pacientes.test.js` |
| 29 | CP-INT-48 | `tests/pacientes.test.js` |

## Iteración 3 — `CP3-xx` ↔ `CP-INT-xx`

| CP3-xx | Id. histórico | Suite |
| ------ | ------------- | ----- |
| 51 | CP-INT-106 | `tests/salas.test.js` |
| 52 | CP-INT-105 | `tests/salas.test.js` |
| 53 | CP-INT-107 | `tests/salas.test.js` |

Los bloques `CP-INT-90`…`CP-INT-219` de salas, citas, notificaciones y concurrencia se documentan en [iteracion-3-salas-citas.md](iteracion-3-salas-citas.md) con su identificador histórico, sin reasignar uno nuevo.

## Iteración 4 — `CP4-INT-xx`

Los identificadores `CP4-INT-01`…`CP4-INT-35` son ya la notación por iteración: **no tienen equivalente distinto** y aparecen igual en `tests/agenda.cp4.test.js`, `front/**/*cp4.test.*`, `e2e/agenda-cp4.spec.ts` y `docs/MATRIZ-TRAZABILIDAD.md`.
