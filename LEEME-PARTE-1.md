# PsicoGestión — Iteración 2-R · Parte 1 (Backend)

Estos archivos se copian **encima de tu repositorio** respetando las rutas (los de `tests/` y `src/` reemplazan o se agregan).

## Instalación
```bash
npm install zod helmet multer umzug sharp express-rate-limit pg pg-hstore
npm run migrate            # aplica migraciones 0001–0005 (en desarrollo también corren al arrancar)
npm run test:backend       # 224 pruebas
npm run server
```

## Variables nuevas (ver .env.example)
`JWT_SECRET` (≥32 caracteres, obligatorio en producción), `CORS_ORIGINS`, `REGISTRO_MODO`,
`DOMINIOS_INSTITUCIONALES_EXTRA`, `TRUST_PROXY`, `DB_AUTO_MIGRATE`, `DB_SSL`.

## Administración
```bash
npm run usuarios:autorizar -- ana@correo.uady.mx            # alta en lista blanca
npm run usuarios:autorizar -- ana@correo.uady.mx --revocar  # revocar
npm run usuarios:rol -- ana@correo.uady.mx administrador    # asignar rol
```
En producción `REGISTRO_MODO` es `lista_blanca` por defecto: nadie puede registrarse sin autorización previa.
