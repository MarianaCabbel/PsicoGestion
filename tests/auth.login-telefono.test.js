const request = require('supertest');
const app = require('../src/app');
const { VALID_PASSWORD, VALID_PHONE, useTestDatabase, seedVerifiedUser } = require('./helpers');

function loginTelefono(overrides = {}) {
  return request(app).post('/api/auth/login-telefono').send({
    telefono: VALID_PHONE,
    password: VALID_PASSWORD,
    ...overrides,
  });
}

describe('Inicio de sesión con teléfono', () => {
  useTestDatabase();

  test('CP-UNI-12 inicio de sesión con teléfono y contraseña correctos', async () => {
    await seedVerifiedUser();

    const res = await loginTelefono();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
  });

  test('CP-UNI-12 acepta el teléfono con separadores', async () => {
    await seedVerifiedUser();

    const res = await loginTelefono({ telefono: '987-654-3210' });

    expect(res.status).toBe(200);
  });

  test('CP-UNI-14 teléfono no registrado devuelve un error genérico', async () => {
    const res = await loginTelefono({ telefono: '0000000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('CP-UNI-16 teléfono correcto con contraseña incorrecta devuelve el mismo mensaje genérico', async () => {
    await seedVerifiedUser();

    const noRegistrado = await loginTelefono({ telefono: '0000000000' });
    const passwordMala = await loginTelefono({ password: 'OtraClave123!' });

    expect(passwordMala.status).toBe(401);
    expect(noRegistrado.status).toBe(401);
    expect(passwordMala.body.message).toBe(noRegistrado.body.message);
    expect(passwordMala.body.message).toBe('Credenciales inválidas.');
  });

  test('CP-UNI-14 y CP-UNI-13 revelan el mismo mensaje en ambos endpoints', async () => {
    const porCorreo = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: 'nadie@correo.uady.mx', password: VALID_PASSWORD });
    const porTelefono = await loginTelefono({ telefono: '0000000000' });

    expect(porCorreo.status).toBe(porTelefono.status);
    expect(porCorreo.body.message).toBe(porTelefono.body.message);
  });

  test('CP-UNI-18 intento de sesión sin llenar el campo teléfono', async () => {
    const res = await loginTelefono({ telefono: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Teléfono y contraseña son obligatorios.');
  });

  test('CP-UNI-19 intento de sesión sin llenar el campo contraseña', async () => {
    const res = await loginTelefono({ password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Teléfono y contraseña son obligatorios.');
  });

  test('CP-UNI-20 inicio de sesión con cuenta no verificada por teléfono', async () => {
    await seedVerifiedUser({ verificado: false });

    const res = await loginTelefono();

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('La cuenta aún no ha sido verificada.');
    expect(res.body.data).toBeUndefined();
  });

  test('el endpoint de correo no acepta teléfono como identificador', async () => {
    await seedVerifiedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: VALID_PHONE, password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });
});
