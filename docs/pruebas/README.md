# Documentación de pruebas por iteración

Este directorio organiza la evidencia de pruebas según la iteración en que se entregó la funcionalidad. La notación canónica es `CP1-INT-xx`, `CP2-xx`, `CP3-xx` y `CP4-INT-xx`. Los títulos de las suites conservan los identificadores históricos (`CP-UNI-xx`, `CP-INT-xx`); la equivalencia se documenta en [mapa-cp.md](mapa-cp.md) y no implica renombrar código.

| Iteración | Alcance | Identificadores | Documento |
| --------- | ------- | --------------- | --------- |
| 1 | Registro de usuario del sistema, inicio de sesión, verificación de correo, recuperación de cuenta y cierre de sesión | `CP1-INT-01`…`CP1-INT-29` | [iteracion-1-autenticacion.md](iteracion-1-autenticacion.md) |
| 2 | Gestión de pacientes y terapeutas, validación de CURP y horarios | `CP2-xx` | [iteracion-2-gestion-clinica.md](iteracion-2-gestion-clinica.md) |
| 3 | Gestión de salas y citas, disponibilidad, anti-traslape, cancelación y notificaciones | `CP3-xx` | [iteracion-3-salas-citas.md](iteracion-3-salas-citas.md) |
| 4 | Vista e impresión de agenda, página de inicio, interfaz y pruebas no funcionales | `CP4-INT-01`…`CP4-INT-35` | [iteracion-4-agenda-interfaz.md](iteracion-4-agenda-interfaz.md) |
| Transversal | Migraciones, auditoría, notificaciones, seguridad y cierre de calidad | `CP-INT-85`…, `CP-UNI-33`… | [transversal.md](transversal.md) |

## Criterios de este directorio

- Los resultados se transcriben de las fuentes existentes; donde no hay evidencia se escribe explícitamente **Sin evidencia directa** o **Sin cobertura**, sin estimar.
- La fecha de referencia de las mediciones es la registrada en `docs/METRICAS-DE-CALIDAD.md` (25 de octubre de 2026).
- Los casos `CP4-INT-xx` ya estaban numerados por iteración en el repositorio y se conservan sin cambio.

## Fuentes comunes

- [Plan de pruebas](../PLAN-DE-PRUEBAS.md)
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md)
- [Métricas de calidad](../METRICAS-DE-CALIDAD.md)
- [Progreso](../PROGRESO.md)
- [Equivalencia de identificadores](mapa-cp.md)
