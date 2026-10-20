const request = require('supertest');
const app = require('../src/app');
const { VALID_EMAIL, VALID_PASSWORD, useTestDatabase, seedVerifiedUser, register } = require('./helpers');

describe('Control de tasa (rate limiting)', () => {
  useTestDatabase();

  beforeAll(() => {
    process.env.FORCE_RATE_LIMIT = 'true';
  });

  afterAll(() => {
    delete process.env.FORCE_RATE_LIMIT;
  });

  test('CP-INT-80 el login bloquea tras 10 intentos fallidos de la misma cuenta y red', async () => {
    await seedVerifiedUser();

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ correo_institucional: VALID_EMAIL, password: 'Incorrecta1!' });
      expect(res.status).toBe(401);
    }

    const bloqueado = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: VALID_EMAIL, password: 'Incorrecta1!' });

    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.message).toBe('Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.');
    expect(bloqueado.headers['ratelimit']).toBeTruthy();
  });

  test('CP-INT-80 el bloqueo es por cuenta: otra cuenta desde la misma red no se ve afectada', async () => {
    const otro = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: 'otra@correo.uady.mx', password: VALID_PASSWORD });

    expect(otro.status).toBe(401);
  });

  test('CP-INT-81 los inicios de sesión exitosos no consumen el cupo', async () => {
    await seedVerifiedUser({ correo_institucional: 'exito@correo.uady.mx', telefono: '9991112222' });

    for (let i = 0; i < 14; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ correo_institucional: 'exito@correo.uady.mx', password: VALID_PASSWORD });
      expect(res.status).toBe(200);
    }
  });

  test('CP-INT-82 recuperar contraseña permite 5 solicitudes por cuenta cada 15 minutos', async () => {
    await seedVerifiedUser({ correo_institucional: 'rec@correo.uady.mx', telefono: '9993334444' });

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/auth/recuperar').send({ correo_institucional: 'rec@correo.uady.mx' });
      expect(res.status).toBe(200);
    }

    const sexta = await request(app).post('/api/auth/recuperar').send({ correo_institucional: 'rec@correo.uady.mx' });
    expect(sexta.status).toBe(429);
    expect(sexta.body.message).toBe('Demasiadas solicitudes. Intenta de nuevo en unos minutos.');
  });

  test('CP-INT-82 reenviar código comparte el límite de solicitudes de correo', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/auth/reenviar-codigo')
        .send({ correo_institucional: 'pendiente@correo.uady.mx' });
      expect(res.status).toBe(200);
    }

    const sexta = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: 'pendiente@correo.uady.mx' });
    expect(sexta.status).toBe(429);
  });

  test('CP-INT-83 la verificación de código tiene su propio tope por red y cuenta', async () => {
    await register(app, { correo_institucional: 'ver@correo.uady.mx', telefono: '9995556666' });

    const respuestas = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post('/api/auth/verificar')
        .send({ correo_institucional: 'ver@correo.uady.mx', codigo_verificacion: '000000' });
      respuestas.push(res.status);
    }

    expect(respuestas.slice(0, 2)).toEqual([400, 400]);
    expect(respuestas[10]).toBe(429);
  });

  test('CP-INT-84 el registro limita las altas por red a 10 por hora', async () => {
    let ultimo;
    for (let i = 0; i < 11; i += 1) {
      ultimo = await register(app, {
        correo_institucional: `u${i}@correo.uady.mx`,
        telefono: `99900000${String(i).padStart(2, '0')}`,
      });
    }

    expect(ultimo.status).toBe(429);
    expect(ultimo.body.message).toBe('Demasiados registros desde esta red. Intenta de nuevo más tarde.');
  });
});
