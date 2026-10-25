# Progreso del proyecto

Checklist del estado del repositorio y sus capacidades implementadas. Las fases reflejan el trabajo entregado; los requisitos pendientes se mantienen sin marcar hasta verificarse.

## Fases

- [x] **Fase 0 — Higiene y base de calidad:** npm workspaces, limpieza de archivos solicitada, configuración de formato/lint y documentación de control.
- [x] **Fase 1 — Backend e identidad:** API Express, persistencia Sequelize, migraciones y autenticación.
- [x] **Fase 2 — Gestión clínica:** pacientes, terapeutas, salas y horarios.
- [x] **Fase 3 — Agenda y notificaciones:** disponibilidad, citas, prevención de conflictos y avisos por correo.
- [x] **Fase 4 — Agenda y dashboard:** agenda día/semana/mes, vista imprimible privada y métricas operativas.
- [x] **Fase 5 — Privacidad y administración:** exportación ARCO auditada, anonimización de expedientes, bitácora y gestión de accesos por rol.
- [ ] **Fase 6 — Calidad y cierre:** cobertura backend y autorización verificadas; build, lint, typecheck, benchmark de agenda y axe en `/privacidad` aprobados. Pendiente cobertura frontend ≥70%, auditoría de accesibilidad de rutas protegidas y objetivos de bundle/Core Web Vitals.

## Requisitos funcionales

- [x] Registro, verificación, inicio y cierre de sesión.
- [x] Recuperación y restablecimiento de contraseña.
- [x] Autorización por roles y control de registro institucional.
- [x] Alta y gestión de pacientes y terapeutas.
- [x] Gestión de salas y consulta de disponibilidad.
- [x] Programación, consulta, modificación y cancelación de citas.
- [x] Prevención de traslapes de sala, terapeuta y paciente.
- [x] Notificaciones de citas y reenvío de confirmaciones.
- [x] Registro de auditoría.
- [x] Exportación de datos de pacientes y anonimización con conservación de citas históricas.
- [x] Bitácora paginada y filtrable, disponible solo para administración y con detalle saneado.
- [x] Gestión administrativa de correos autorizados, usuarios y roles con invalidación de sesiones anteriores.
- [x] Aviso de privacidad público y versionado, enlazado desde los flujos de registro.

## Requisitos no funcionales

- [x] Validación de entradas con Zod y errores HTTP consistentes.
- [x] Migraciones versionadas y base SQLite aislada en las pruebas locales.
- [x] Suite de backend ejecutable en SQLite y opción de PostgreSQL mediante `TEST_DATABASE_URL`.
- [x] Herramientas base: ESLint, Prettier, TypeScript y EditorConfig.
- [x] Exclusión de archivos locales de entorno, cobertura, SQLite y Next.js del control de versiones.
- [x] Acciones administrativas protegidas en API y frontend; doble confirmación para anonimizar.
- [x] Cobertura backend ≥85% en statements/líneas y ≥95% en statements/líneas de CURP, slots y anti-traslape.
- [x] Prueba automática de sesión y rol en las rutas registradas de los módulos API.
- [ ] Cobertura global frontend ≥70% (medición actual: 31.03%).
- [x] Axe-core sin violaciones en el aviso público auditado en navegador de producción.
- [ ] Medición de bundle y rendimiento con objetivos de release/Core Web Vitals acordados.
- [ ] Validar configuración real de producción (base de datos, SMTP, orígenes permitidos, TLS y secretos).
- [ ] Definir objetivos y mediciones de rendimiento, disponibilidad y recuperación.
