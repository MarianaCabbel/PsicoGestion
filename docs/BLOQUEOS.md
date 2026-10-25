# Bloqueos

## Bloqueos activos

- Ninguno identificado para instalar el monorepo con npm y ejecutar la suite local del backend.
- La cobertura global medida del frontend es 31.03% (objetivo: 70%). Se requieren pruebas adicionales para páginas y componentes todavía no cubiertos; no se debe declarar cerrada la Fase 6 hasta elevarla.
- La auditoría axe de navegador se ejecutó en `/privacidad`. La auditoría de las rutas clínicas protegidas requiere una sesión de prueba y queda pendiente.

## Dependencias para validación de otros entornos

- `npm run test:pg` requiere PostgreSQL disponible y una base de pruebas configurada mediante `TEST_DATABASE_URL`.
- El envío real de correo requiere credenciales SMTP; sin ellas, no se puede validar el flujo de correo en un entorno integrado.
- El despliegue requiere definir el proveedor, las variables seguras y las reglas de operación del entorno final.
- Las pruebas PostgreSQL requieren `TEST_DATABASE_URL` y una instancia de pruebas disponible.
- No se han definido umbrales de release para el tamaño transferido del bundle ni para Core Web Vitals.
- El aviso de privacidad v1.0 está publicado como información operativa. La institución debe confirmar y publicar el domicilio/contacto de privacidad, plazos de conservación y procedimiento formal de atención ARCO, además de validar legalmente el texto antes de producción.
