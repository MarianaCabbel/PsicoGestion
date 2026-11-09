const request = require('supertest');
const app = require('../src/app');
const { VALID_EMAIL, VALID_PASSWORD, useTestDatabase, seedVerifiedUser } = require('./helpers');

function login(overrides = {}) {
  return request(app).post('/api/auth/login').send({
    correo_institucional: VALID_EMAIL,
    password: VALID_PASSWORD,
    ...overrides,
  });
}

describe('Inicio de sesión con correo', () => {
  useTestDatabase();

  test('CP-UNI-11 inicio de sesión con correo y contraseña correctos', async () => {
    await seedVerifiedUser();

    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.expiresIn).toBe('8h');
  });

  test('CP-UNI-13 correo no registrado devuelve un error genérico', async () => {
    const res = await login({ correo_institucional: 'nadie@correo.uady.mx' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('CP-UNI-15 correo correcto con contraseña incorrecta devuelve el mismo mensaje genérico', async () => {
    await seedVerifiedUser();

    const noRegistrado = await login({
      correo_institucional: 'nadie@correo.uady.mx',
      password: 'Password123!',
    });
    const passwordMala = await login({ password: 'OtraClave123!' });

    expect(passwordMala.status).toBe(401);
    expect(noRegistrado.status).toBe(401);
    expect(passwordMala.body.message).toBe(noRegistrado.body.message);
    expect(passwordMala.body.message).toBe('Credenciales inválidas.');
  });

  test('CP-UNI-17 intento de sesión sin llenar el campo correo', async () => {
    const res = await login({ correo_institucional: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Correo y contraseña son obligatorios.');
  });

  test('CP-UNI-19 intento de sesión sin llenar el campo contraseña', async () => {
    const res = await login({ password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Correo y contraseña son obligatorios.');
  });

  test('CP-UNI-20 inicio de sesión con correo no validado', async () => {
    await seedVerifiedUser({ verificado: false });

    const res = await login();

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('La cuenta aún no ha sido verificada.');
    expect(res.body.data).toBeUndefined();
  });
});
