# Iteración 2 — Gestión clínica (`CP2-xx`)

## Alcance

Alta, consulta, edición y baja de pacientes y terapeutas; validación de CURP, fecha de nacimiento, teléfono y cédula profesional; configuración del horario semanal; conservación de datos ante errores 409 o de conexión. Quedan fuera salas, citas y agenda.

## Catálogo de casos

Los `CP2-xx` están citados entre paréntesis en los títulos de las suites; su equivalencia con `CP-INT-xx` se detalla en [mapa-cp.md](mapa-cp.md).

| ID | Caso | Suite principal | Estado |
| -- | ---- | --------------- | ------ |
| CP2-02 | Rechaza nombre de más de 50 caracteres (terapeuta) | `tests/terapeutas.test.js` (`CP-INT-64`) | Cubierto |
| CP2-03 | Teléfono duplicado responde 409 por campo | `tests/terapeutas.test.js` (`CP-INT-64`) | Cubierto |
| CP2-05 | Rechaza fecha de nacimiento futura | `tests/terapeutas.test.js` (`CP-INT-64`) | Cubierto |
| CP2-10 | El perfil muestra todos los datos del terapeuta | `tests/terapeutas.test.js` (`CP-INT-65`) | Cubierto |
| CP2-12 | En edición, teléfono duplicado se rechaza y el propio se conserva | `tests/terapeutas.test.js` (`CP-INT-65`) | Cubierto |
| CP2-13 | En edición, nombre o fecha inválidos no guardan | `tests/terapeutas.test.js` (`CP-INT-65`) | Cubierto |
| CP2-15 | Error de conexión al guardar responde 503 y conserva lo escrito | `tests/terapeutas.test.js` (`CP-INT-66`) | Cubierto |
| CP2-17 | Rechaza nombre de más de 50 caracteres (paciente) | `tests/pacientes.test.js` (`CP-INT-46`) | Cubierto |
| CP2-25 | El perfil muestra todos los datos del paciente | `tests/pacientes.test.js` (`CP-INT-47`) | Cubierto |
| CP2-28 | Rechaza nombre o fecha inválidos en edición de paciente | `tests/pacientes.test.js` (`CP-INT-47`) | Cubierto |
| CP2-29 | Error de conexión al guardar paciente responde 503 | `tests/pacientes.test.js` (`CP-INT-48`) | Cubierto |

### Suites de apoyo sin ID CP2 propio

| Suite | Cobertura |
| ----- | --------- |
| `tests/lib.curp-fechas.test.js` | `CP-UNI-30`…`CP-UNI-32`: estructura, fecha, sexo y dígito verificador de CURP; edad cumplida. |
| `front/components/clinical/patient-form.test.tsx` | Validación clínica y conservación de valores en el formulario de paciente. |
| `front/components/clinical/therapist-form.test.tsx` | Validación del formulario de terapeuta y su horario semanal. |
| `front/lib/clinical-validation.test.ts` | Reglas clínicas compartidas con el backend. |
| `tests/migraciones.test.js` | Esquema de patients y therapists; se documenta en [transversal.md](transversal.md). |

## Ejecución registrada

- **Entorno:** SQLite en memoria; PostgreSQL opcional con `TEST_DATABASE_URL`.
- **Comandos:** `npm run test:backend`, `npm run test:frontend`.
- **Resultado global:** backend 428/428; frontend 83/83.
- **Lógica crítica:** `src/lib/curp.js` con 95.34% statements y 100% líneas.
- **Fecha de medición:** 25 de octubre de 2026.

## Evidencia

- [Plan de pruebas](../PLAN-DE-PRUEBAS.md): cobertura funcional de CURP y autorización (PT-01, PT-02, PT-03).
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md): edición de salas no aplica aquí; ver filas de pacientes y terapeutas y validación de CURP.
- [Métricas de calidad](../METRICAS-DE-CALIDAD.md): cobertura de lógica crítica.

## Pendientes

- Auditoría de accesibilidad con teclado en formularios clínicos protegidos.

