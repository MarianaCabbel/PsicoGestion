const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const { requireRole, requirePermission } = require('../src/middleware/requireRole');
const { validate } = require('../src/middleware/validate');
const { errorHandler, AppError } = require('../src/utils/errors');
const { PERMISOS } = require('../src/config/permisos');
const { registrarBajaGuard, limpiarBajaGuards, verificarBajaPermitida } = require('../src/lib/bajaGuards');
const { calcularPaginacion, respuestaPaginada, patronContiene } = require('../src/lib/paginacion');
const { escapeHtml } = require('../src/utils/email');

function appCon(usuario, ...handlers) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = usuario;
    next();
  });
  app.post('/prueba', ...handlers, (req, res) => res.json({ ok: true, validado: req.validated }));
  app.use(errorHandler);
  return app;
}

describe('requireRole / requirePermission', () => {
  test('CP-UNI-34 permite el rol indicado y rechaza otros con 403', async () => {
    const admin = await request(appCon({ id: 1, rol: 'administrador' }, requireRole('administrador'))).post('/prueba');
    expect(admin.status).toBe(200);

    const secretaria = await request(appCon({ id: 1, rol: 'secretaria' }, requireRole('administrador'))).post('/prueba');
    expect(secretaria.status).toBe(403);
    expect(secretaria.body.message).toBe('No tienes permisos para realizar esta acción.');
  });

  test('CP-UNI-34 sin usuario autenticado responde 401', async () => {
    const res = await request(appCon(undefined, requireRole('secretaria'))).post('/prueba');
    expect(res.status).toBe(401);
  });

  test('CP-UNI-34 requirePermission usa la matriz y falla al arrancar con permisos inexistentes', async () => {
    expect(() => requirePermission('inventado:algo')).toThrow(/Permiso desconocido/);

    const reactivar = requirePermission('pacientes:reactivar');
    expect((await request(appCon({ rol: 'secretaria' }, reactivar)).post('/prueba')).status).toBe(403);
    expect((await request(appCon({ rol: 'administrador' }, reactivar)).post('/prueba')).status).toBe(200);
  });

  test('CP-UNI-34 todos los permisos definen al menos un rol válido', () => {
    Object.entries(PERMISOS).forEach(([permiso, roles]) => {
      expect(roles.length).toBeGreaterThan(0);
      roles.forEach((rol) => expect(['secretaria', 'administrador']).toContain(rol));
      expect(permiso).toMatch(/^[a-z]+:[a-z]+$/);
    });
  });
});

describe('validate (zod)', () => {
  const esquema = z.object({
    nombre: z.string({ error: 'El nombre es obligatorio.' }).min(2, 'El nombre es muy corto.'),
    edad: z.coerce.number().int().min(0, 'La edad no puede ser negativa.'),
  });

  test('CP-UNI-35 entrega los datos normalizados en req.validated', async () => {
    const res = await request(appCon({}, validate({ body: esquema }))).post('/prueba').send({ nombre: 'Ana', edad: '30' });

    expect(res.status).toBe(200);
    expect(res.body.validado.body).toEqual({ nombre: 'Ana', edad: 30 });
  });

  test('CP-UNI-35 responde 400 con el primer mensaje y el detalle por campo', async () => {
    const res = await request(appCon({}, validate({ body: esquema }))).post('/prueba').send({ nombre: 'A', edad: -1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El nombre es muy corto.');
    expect(res.body.errors).toEqual({ nombre: 'El nombre es muy corto.', edad: 'La edad no puede ser negativa.' });
  });

  test('CP-UNI-35 un cuerpo ausente se trata como objeto vacío', async () => {
    const res = await request(appCon({}, validate({ body: esquema }))).post('/prueba');
    expect(res.status).toBe(400);
    expect(res.body.errors.nombre).toBeTruthy();
  });
});

describe('errorHandler', () => {
  function appConError(error) {
    const app = express();
    app.get('/error', (req, res, next) => next(error));
    app.use(errorHandler);
    return app;
  }

  test('CP-UNI-36 incluye errores por campo y metadatos de AppError', async () => {
    const res = await request(appConError(new AppError('Mal', 400, null, { a: 'x' }, { intentos_restantes: 2 }))).get('/error');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Mal', errors: { a: 'x' }, intentos_restantes: 2 });
  });

  test('CP-UNI-36 en producción los errores 500 no filtran el mensaje interno', async () => {
    const previo = process.env.NODE_ENV;
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(appConError(new Error('detalle SQL secreto'))).get('/error');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Error interno del servidor.');
      expect(JSON.stringify(res.body)).not.toContain('SQL');
    } finally {
      process.env.NODE_ENV = previo;
      consola.mockRestore();
    }
  });

  test('CP-UNI-36 una violación de unicidad no controlada se traduce a 409', async () => {
    const error = Object.assign(new Error('unique'), { name: 'SequelizeUniqueConstraintError' });
    const res = await request(appConError(error)).get('/error');

    expect(res.status).toBe(409);
  });
});

describe('utilidades', () => {
  afterEach(() => limpiarBajaGuards());

  test('CP-UNI-37 las reglas de baja se evalúan en orden y la primera que bloquea gana', async () => {
    const llamadas = [];
    registrarBajaGuard('paciente', async () => {
      llamadas.push('a');
      return null;
    });
    registrarBajaGuard('paciente', async () => {
      llamadas.push('b');
      return 'Bloqueado por B';
    });
    registrarBajaGuard('paciente', async () => {
      llamadas.push('c');
      return 'Bloqueado por C';
    });

    await expect(verificarBajaPermitida('paciente', 1)).rejects.toMatchObject({
      message: 'Bloqueado por B',
      statusCode: 409,
    });
    expect(llamadas).toEqual(['a', 'b']);
  });

  test('CP-UNI-37 sin reglas la baja está permitida y las entidades desconocidas se rechazan', async () => {
    await expect(verificarBajaPermitida('paciente', 1)).resolves.toBeUndefined();
    expect(() => registrarBajaGuard('inexistente', async () => null)).toThrow(/Entidad desconocida/);
  });

  test('CP-UNI-38 la paginación acota página y límite', () => {
    expect(calcularPaginacion({})).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(calcularPaginacion({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(calcularPaginacion({ page: -5, limit: 9999 })).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(respuestaPaginada([1], 41, { page: 1, limit: 20 }).total_paginas).toBe(3);
    expect(respuestaPaginada([], 0, { page: 1, limit: 20 }).total_paginas).toBe(1);
  });

  test('CP-UNI-38 el patrón de búsqueda elimina comodines del usuario', () => {
    expect(patronContiene(' a%b_c\\d ')).toBe('%abcd%');
  });

  test('CP-UNI-39 el correo escapa HTML para evitar inyección en las plantillas', () => {
    expect(escapeHtml('<img src=x onerror="a()">&\'')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
  });
});
