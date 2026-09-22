# PsicoGestion

Backend de Node.js + Express para el módulo de autenticación de PsicoGestión.

## Tecnologías

- Node.js
- Express
- Sequelize
- MySQL / PostgreSQL
- SQLite (para pruebas)
- JWT
- bcrypt
- Joi
- nodemailer
- Jest + Supertest

## Requisitos

- Node.js 18+
- MySQL o PostgreSQL
- Git

## Instalar dependencias

```bash
npm install
```

## Variables de entorno

Copia el archivo `.env.example` a `.env` y configura tus credenciales.

```bash
cp .env.example .env
```

## Ejecutar en desarrollo

```bash
npm run dev
```

## Ejecutar pruebas

```bash
npm test
```

## Endpoints principales

### Registro

```http
POST /api/auth/registro
```

Body:

```json
{
  "nombre_completo": "Ana López",
  "correo_institucional": "ana@psicogestion.com",
  "telefono": "987654321",
  "password": "Password123!",
  "confirmar_password": "Password123!"
}
```

### Verificación

```http
POST /api/auth/verificar
```

```json
{
  "correo_institucional": "ana@psicogestion.com",
  "codigo_verificacion": "123456"
}
```

### Login

```http
POST /api/auth/login
```

```json
{
  "correo_institucional": "ana@psicogestion.com",
  "password": "Password123!"
}
```

### Logout

```http
POST /api/auth/logout
```

Headers:

```http
Authorization: Bearer <token>
```

### Recuperación

```http
POST /api/auth/recuperar
```

```json
{
  "correo_institucional": "ana@psicogestion.com"
}
```

### Restablecer contraseña

```http
POST /api/auth/restablecer
```

```json
{
  "token": "<token>",
  "nueva_password": "NuevaClave2024!",
  "confirmar_password": "NuevaClave2024!"
}
```

## Estructura del proyecto

```text
src/
  app.js
  server.js
  config/
    database.js
  middleware/
    authMiddleware.js
  models/
    User.js
  routes/
    authRoutes.js
  utils/
    authHelpers.js
    email.js
    errors.js

tests/
  auth.validation.test.js
  auth.integration.test.js
```

## Notas

- En desarrollo se usa SQLite para pruebas.
- Para MySQL/PostgreSQL, configura las variables de entorno y usa el dialecto apropiado.
- El módulo de autenticación está preparado para futuras rutas protegidas con JWT.

## GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/MarianaCabbel/PsicoGestion.git
git push -u origin main
```
