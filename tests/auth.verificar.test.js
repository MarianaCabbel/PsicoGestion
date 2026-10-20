const request = require('supertest');
const { User } = require('../src/config/database');
const app = require('../src/app');
const { VALID_EMAIL, VALID_PASSWORD, useTestDatabase, register } = require('./helpers');

function wrongCodeFor(stored) {
  return String((Number(stored) + 1) % 1000000).padStart(6, '0');
}

describe('Verificación de correo', () => {
  useTestDatabase();

  test('CP-UNI-07 rechaza un código distinto al enviado y no completa el registro', async () => {
    await register(app);
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    const stored = user.codigo_verificacion;

    const res = await request(app).post('/api/auth/verificar').send({
      correo_institucional: VALID_EMAIL,
      codigo_verificacion: wrongCodeFor(stored),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('El código de verificación es incorrecto.');

    await user.reload();
    expect(user.verificado).toBe(false);
    expect(user.codigo_verificacion).toBe(stored);
  });

  test('CP-UNI-07 rechaza el código cuando faltan los datos', async () => {
    const res = await request(app)
      .post('/api/auth/verificar')
      .send({ correo_institucional: VALID_EMAIL });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Correo y código de verificación son obligatorios.');
  });

  test('CP-UNI-07 responde igual si el correo no existe (no revela qué cuentas existen)', async () => {
    const res = await request(app).post('/api/auth/verificar').send({
      correo_institucional: 'nadie@correo.uady.mx',
      codigo_verificacion: '123456',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El código de verificación es incorrecto.');
  });

  test('CP-UNI-08 rechaza un código expirado e indica que expiró', async () => {
    await register(app);
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });

    user.codigo_expira_en = new Date(Date.now() - 1000);
    await user.save();

    const res = await request(app).post('/api/auth/verificar').send({
      correo_institucional: VALID_EMAIL,
      codigo_verificacion: user.codigo_verificacion,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El código de verificación ha expirado. Solicita uno nuevo.');

    await user.reload();
    expect(user.verificado).toBe(false);
    expect(user.codigo_verificacion).toBeTruthy();
  });

  test('CP-UNI-08 el reenvío emite un código nuevo que sí permite verificar', async () => {
    await register(app);
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });

    user.codigo_expira_en = new Date(Date.now() - 1000);
    await user.save();
    const codigoVencido = user.codigo_verificacion;

    const resend = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: VALID_EMAIL });

    expect(resend.status).toBe(200);
    expect(resend.body.success).toBe(true);

    await user.reload();
    expect(user.codigo_verificacion).not.toBe(codigoVencido);
    expect(user.codigo_verificacion).toMatch(/^\d{6}$/);
    expect(user.codigo_expira_en.getTime()).toBeGreaterThan(Date.now());

    const verificacion = await request(app).post('/api/auth/verificar').send({
      correo_institucional: VALID_EMAIL,
      codigo_verificacion: user.codigo_verificacion,
    });

    expect(verificacion.status).toBe(200);

    await user.reload();
    expect(user.verificado).toBe(true);
    expect(user.codigo_verificacion).toBeNull();
    expect(user.codigo_expira_en).toBeNull();
  });

  test('CP-UNI-08 el reenvío no revela si el correo existe', async () => {
    await register(app);

    const inexistente = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: 'nadie@correo.uady.mx' });

    const registrado = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: VALID_EMAIL });

    expect(inexistente.status).toBe(200);
    expect(inexistente.body.message).toBe(registrado.body.message);
  });

  test('CP-UNI-08 el reenvío rechaza un correo con formato inválido', async () => {
    const res = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: 'ana@gmail.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El correo debe ser institucional de la UADY (@…uady.mx).');
  });

  test('CP-UNI-08 el reenvío no modifica una cuenta ya verificada', async () => {
    await register(app);
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });

    await request(app)
      .post('/api/auth/verificar')
      .send({ correo_institucional: VALID_EMAIL, codigo_verificacion: user.codigo_verificacion });

    const resend = await request(app)
      .post('/api/auth/reenviar-codigo')
      .send({ correo_institucional: VALID_EMAIL });

    expect(resend.status).toBe(200);

    await user.reload();
    expect(user.verificado).toBe(true);
    expect(user.codigo_verificacion).toBeNull();
    expect(user.codigo_expira_en).toBeNull();
  });
});
