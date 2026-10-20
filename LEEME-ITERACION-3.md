# PsicoGestión — Iteración 3 · Salas y Citas (Backend)

Copia estos archivos **encima de tu repositorio** respetando las rutas. No hay dependencias nuevas.

```bash
npm run migrate          # aplica 0006_salas, 0007_citas y 0008_notificaciones
npm run test:backend     # suite backend (SQLite en memoria)
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/psicogestion_test npm run test:backend   # mismas pruebas en PostgreSQL
npm run server           # el worker de correos arranca solo (NOTIFICACIONES_WORKER=false lo desactiva)
```

## Cómo se garantiza que no haya traslapes
Cada cita escribe **una fila por bloque de 30 min** en `cita_ocupaciones`. Tres índices ÚNICOS lo hacen cumplir en la base de datos:

| Índice | Evita |
| --- | --- |
| `(sala_id, fecha, slot)` | dos citas en la misma sala |
| `(terapeuta_id, fecha, slot)` | un terapeuta en dos citas |
| `(paciente_id, fecha, slot)` | un paciente en dos citas |

La aplicación revisa antes para dar mensajes claros (409 con `errors` por campo); si dos peticiones empatan en la carrera, el índice rechaza a la segunda y el servicio la traduce al mismo 409. Cancelar borra las ocupaciones; "vencida" se calcula (no se guarda).
Folios `CIT-AAAA-000000`: contador anual atómico dentro de la transacción de la cita (sin duplicados ni huecos).

## Endpoints (todos requieren sesión)
| Método | Ruta | Descripción |
| --- | --- | --- |
| POST · GET | `/api/salas` | Alta (nombre ≤10, único sin acentos/mayúsculas) · lista con `citas_hoy` y `ocupada_ahora` |
| GET | `/api/salas/disponibilidad?fecha=` | Bloques ocupados por sala en un día |
| GET | `/api/salas/:id/disponibilidad?desde=&hasta=` | Por día: `libre` · `parcial` · `reservada` (máx. 62 días) |
| GET · DELETE | `/api/salas/:id` | Detalle · baja lógica `{confirmar:true}` (409 si hay citas futuras) |
| POST | `/api/salas/:id/reactivar` | Solo administrador |
| GET | `/api/citas/disponibilidad?fecha=&terapeuta_id=&paciente_id=&duracion_slots=&excluir_cita_id=` | Horas de inicio válidas y salas libres |
| POST | `/api/citas` | Agenda (201): folio + ocupaciones + aviso, en una transacción |
| GET | `/api/citas?estado=&sala_id=&terapeuta_id=&paciente_id=&rango=dia\|semana\|mes&fecha=&desde=&hasta=&orden=&page=&limit=` | Listado; `estado` = pendiente · vencida · cancelada · todas |
| GET | `/api/citas/:id` · `/api/citas/folio/:folio` | Detalle con estado del correo |
| PUT | `/api/citas/:id` | Modifica (parcial); no sirve para canceladas/vencidas |
| POST | `/api/citas/:id/cancelar` · `/api/citas/folio/:folio/cancelar` | `{confirmar:true, motivo?}` |
| POST | `/api/citas/:id/reenviar-confirmacion` | Reencola el correo |

## Reglas conectadas con la Parte 1
* Dar de baja un paciente, terapeuta o sala con citas pendientes futuras → 409 con los folios.
* `PUT /api/terapeutas/:id/horarios` que dejaría fuera citas pendientes → 409 con `folios_afectados`; se confirma con `confirmar_conflictos:true`.
* Todas las transacciones de servicios pasan por `src/lib/transaccion.js` (reintenta deadlocks en PostgreSQL; serializa en SQLite).

## Parámetros a confirmar con el SEAP (`src/config/clinica.js`)
`DURACION_CITA_SLOTS_DEFECTO = 2` (60 min), `DIAS_ATENCION = [1..5]`, `HORA_INICIO/HORA_FIN = 07:00/19:00`, `REQUIERE_HORARIO_TERAPEUTA = true`.

## Archivos de la Parte 1 que se actualizan (reemplazar)
`.env.example`, `src/app.js`, `src/server.js`, `src/config/{clinica,database,permisos}.js`, `src/lib/fechas.js`, `src/modules/comun.validators.js`, `src/modules/pacientes/pacientes.service.js`, `src/modules/terapeutas/{controller,service,validators}`, `src/utils/email.js`, `tests/{fixtures,helpers,migraciones.test,pacientes.test}.js`.
> `tests/fixtures.js` corrige una fragilidad de `fechaHace` de la Parte 1 (usaba fecha UTC y fallaba pasadas las 18:00 en Mérida).
