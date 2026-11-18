# Iteración 3 — Salas y citas (`CP3-xx`)

## Alcance

Alta, edición, consulta y baja lógica de salas; consulta de disponibilidad; programación, consulta, modificación y cancelación de citas; prevención de traslapes de sala, terapeuta y paciente; folios consecutivos; notificaciones por correo y worker de envío. Quedan fuera la gestión de pacientes/terapeutas (iteración 2) y la vista de agenda (iteración 4).

## Catálogo de casos `CP3-xx`

| ID | Caso | Suite principal | Estado |
| -- | ---- | --------------- | ------ |
| CP3-51 | Cancelar libera la sala y permite reagendar | `tests/salas.test.js` (`CP-INT-106`) | Cubierto |
| CP3-52 | Agendar marca la sala como reservada ese día | `tests/salas.test.js` (`CP-INT-105`) | Cubierto |
| CP3-53 | Cambiar la cita de sala libera la anterior y reserva la nueva | `tests/salas.test.js` (`CP-INT-107`) | Cubierto |

La disponibilidad es binaria (`libre`/`reservada`); `parcial` y `completa` solo describen densidad visual. Ver [plan de pruebas](../PLAN-DE-PRUEBAS.md), línea de disponibilidad.

## Bloques de apoyo con identificador histórico

### Salas — `CP-INT-90`…`CP-INT-107`
`tests/salas.test.js` cubre alta y edición con nombre único normalizado (máximo 10 caracteres), 409 por duplicado, baja lógica con citas pendientes o en curso, reactivación administrativa, disponibilidad por día (máximo 62 días) y auditoría. Casos citados en la [matriz](../MATRIZ-TRAZABILIDAD.md): `CP-INT-96/97` y `CP-INT-102/104`.

### Citas — `CP-INT-110`…`CP-INT-181`
`tests/citas.test.js` cubre:

| Bloque | Casos representativos |
| ------ | --------------------- |
| 110…118 | Alta, folio consecutivo y anual, duración, campos obligatorios, recursos inexistentes o dados de baja, fechas pasadas, fines de semana, horario del terapeuta. |
| 120…123 | Traslapes de sala/terapeuta/paciente, traslapes parciales, citas contiguas y liberación al cancelar. |
| 130…135 | Detalle por id y folio, estados (pendiente, vencida, cancelada, todas), filtros, orden y paginación. |
| 140…144 | Modificación con cambio de sala, conflicto 409, reglas de calendario y cambio de terapeuta/paciente. |
| 150…153 | Cancelación con confirmación explícita, por folio, doble cancelación y avisos. |
| 160…164 | Disponibilidad coherente con el alta, exclusión de horarios ocupados y duración solicitada. |
| 170…171 | Baja de recursos con citas futuras y cambio de horario que deja citas fuera. |
| 180…181 | Autenticación en rutas de citas y salas; auditoría sin datos personales. |

### Utilidades — `CP-UNI-40`…`CP-UNI-47`
`tests/lib.slots-rangos.test.js`: 24 bloques de 30 minutos entre 07:00 y 19:00, conversión hora/bloque, fusión de franjas, semanas de lunes a domingo, meses completos, reloj de Mérida en pruebas, estado vencido, formato de folio y normalización de nombres de sala.

### Concurrencia — `CP-INT-210`…`CP-INT-219`
`tests/citas.concurrencia.test.js`: 20 altas simultáneas por sala, terapeuta y paciente (una sola gana), folios únicos sin huecos con recursos distintos, traslapes parciales, operaciones mixtas, inserciones paralelas del mismo bloque, índices únicos como última barrera y `RESTRICT` al borrado físico.

### Notificaciones — `CP-INT-190`…`CP-INT-201`
`tests/notificaciones.test.js`: encolado sin envío dentro de la petición, tolerancia a fallo SMTP, worker con reintentos crecientes (1, 5, 15 y 60 minutos), error sin correos, recuperación de registros `procesando` y reenvío de confirmaciones. Detalle en [transversal.md](transversal.md).

### Frontend de apoyo
`slot-picker.test.tsx`, `appointment-wizard.test.tsx`, `salas-page.test.tsx` y `citas-page.test.tsx`: horarios ofrecidos, conservación ante 409, confirmación antes de modificar, enlace directo por folio y refresco entre pestañas.

## Ejecución registrada

- **Entorno:** SQLite en memoria; PostgreSQL opcional con `TEST_DATABASE_URL`.
- **Comandos:** `npm run test:backend`, `npm run test:frontend`, `npm run test:e2e`.
- **Resultado global:** backend 428/428; frontend 83/83.
- **Lógica crítica:** `src/lib/slots.js` 100% statements y líneas; `src/modules/citas/citas.service.js` 98.22% statements y 98.31% líneas.
- **Fecha de medición:** 25 de octubre de 2026.

## Evidencia

- [Plan de pruebas](../PLAN-DE-PRUEBAS.md): PT-01, PT-02, PT-08, PT-14, PT-16 y lineas de disponibilidad, citas y salas.
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md): filas de salas, baja, disponibilidad y siguientes.
- [Métricas de calidad](../METRICAS-DE-CALIDAD.md): cobertura de lógica crítica.

## Pendientes

- Ejecutar la suite contra PostgreSQL con una base aislada (`TEST_DATABASE_URL`).