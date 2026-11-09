const request = require('supertest');
const app = require('../src/app');
const { VALID_EMAIL, VALID_PASSWORD, useTestDatabase, seedVerifiedUser, loginAndToken } = require('./helpers');

describe('Cierre de sesión', () => {
  useTestDatabase();

  test('CP-UNI-21 cerrar sesión exitosamente invalida el token emitido', async () => {
    await seedVerifiedUser();
    const token = await loginAndToken(app);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);
    expect(logout.body.message).toBe('Sesión cerrada correctamente.');

    const reuse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toBe('La sesión ya no es válida. Inicia sesión de nuevo.');
  });

  test('CP-UNI-21 permite iniciar sesión de nuevo tras cerrar la sesión', async () => {
    await seedVerifiedUser();
    const tokenViejo = await loginAndToken(app);

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokenViejo}`);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: VALID_EMAIL, password: VALID_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();

    const reuse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokenViejo}`);

    expect(reuse.status).toBe(401);
  });

  test('rechaza el cierre de sesión sin token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token de autenticación requerido.');
  });

  test('rechaza el cierre de sesión con un token manipulado', async () => {
    await seedVerifiedUser();
    const token = await loginAndToken(app);
    const [header, payload] = token.split('.');

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${header}.${payload}.firma-invalida`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token inválido o expirado.');
  });
});
