# Plan de pruebas

Este plan registra los controles ejecutados en la Fase 6 y las validaciones externas que aún requieren configuración.

| ID    | Área / requisito                        | Prueba o comando                                | Criterio                                                                        | Resultado                                                        |
| ----- | --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| PT-01 | Backend completo                        | `npm run test:backend`                          | Todas las suites y pruebas pasan                                                | Aprobado (19 suites, 343/343)                                    |
| PT-02 | Cobertura backend                       | `npm run test:backend:coverage`                 | ≥85% statements y líneas; ≥95% statements/líneas en CURP, slots y anti-traslape | Aprobado                                                         |
| PT-03 | Autorización API                        | `tests/router.authorization.test.js`            | Sesión ausente/inválida → 401; rol insuficiente → 403                           | Aprobado                                                         |
| PT-04 | Cobertura frontend                      | `npm run test:frontend:coverage`                | ≥70% en el conjunto de código productivo medido                                 | **No aprobado: 31.03%**                                          |
| PT-05 | Flujos frontend                         | `npm run test:frontend`                         | Todas las pruebas pasan; incluye slots, asistente y conservación ante 409       | Aprobado (22/22)                                                 |
| PT-06 | WCAG automatizado                       | `front/test/accessibility.test.tsx`             | Sin violaciones axe en componentes examinados                                   | Aprobado (2 pruebas)                                             |
| PT-07 | axe en navegador                        | Build de producción, ruta `/privacidad`         | 0 violaciones WCAG 2.1 AA, incluido contraste                                   | Aprobado (0; 31 reglas)                                          |
| PT-08 | Agenda / render                         | `front/app/(app)/agenda/agenda-page.test.tsx`   | Renderiza 42 citas dentro del límite de 500 ms por render                       | Aprobado                                                         |
| PT-09 | Build                                   | `npm run build:client`                          | Build de producción y generación de rutas correctos                             | Aprobado                                                         |
| PT-10 | Análisis estático                       | `npm run lint`, `npm run typecheck`             | Sin errores                                                                     | Aprobado                                                         |
| PT-11 | Complejidad ciclomática                 | ESLint `complexity` con máximo de referencia 10 | Revisar funciones superiores al límite                                          | 6 hallazgos documentados                                         |
| PT-12 | PostgreSQL                              | `npm run test:pg`                               | Suite contra PostgreSQL de pruebas                                              | No ejecutado: requiere `TEST_DATABASE_URL` y servidor disponible |
| PT-13 | Core Web Vitals y presupuesto de bundle | Lighthouse / medición de red de producción      | Umbrales acordados para LCP, INP, CLS y bytes transferidos                      | Pendiente de definir entorno y objetivos                         |

## Cobertura funcional y técnica

- **CURP:** estructura, fecha, sexo y dígito verificador; prueba unitaria en `front/lib/clinical-validation.test.ts` y validación backend.
- **Disponibilidad y anti-traslape:** pruebas de slots, concurrencia de citas y servicio de citas.
- **Conservación ante conflicto:** el test del asistente verifica que un 409 refresca horarios sin perder las selecciones.
- **Autorización:** las rutas registradas de los routers de módulos exigen sesión y los recursos administrativos verifican rol.
- **ARCO:** pruebas de integración para exportación, anonimización y restricciones de acceso en `tests/privacidad.admin.test.js`; prueba del flujo de doble confirmación en frontend.
- **Accesibilidad:** axe sobre aviso y formulario, además de auditoría en navegador del aviso público; las rutas clínicas con sesión necesitan auditoría adicional.
- **Rendimiento:** benchmark sintético de agenda con 42 citas. No sustituye carga representativa en navegador ni telemetría de producción.

## Criterios de cierre pendientes

1. Añadir pruebas para rutas y componentes frontend sin cobertura hasta elevar statements/líneas globales al 70% o superior.
2. Completar axe y teclado en rutas protegidas con una sesión de prueba que incluya los roles secretaria y administrador.
3. Definir presupuesto de bundle transferido y objetivos de Core Web Vitals; repetir mediciones en un entorno representativo.
4. Ejecutar PostgreSQL cuando se disponga de una instancia de pruebas aislada.
