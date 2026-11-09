const request = require('supertest');
const { User } = require('../src/config/database');
const app = require('../src/app');
const { VALID_EMAIL, VALID_PHONE, VALID_PASSWORD, useTestDatabase, register } = require('./helpers');

describe('Registro de usuarios', () => {
  useTestDatabase();

  test('CP-UNI-01 registro exitoso con todos los datos válidos', async () => {
    const res = await register(app);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.correo_institucional).toBe(VALID_EMAIL);

    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    expect(user).toBeTruthy();
    expect(user.verificado).toBe(false);
    expect(user.telefono).toBe(VALID_PHONE);
    expect(user.codigo_verificacion).toMatch(/^\d{6}$/);
    expect(user.codigo_expira_en).toBeTruthy();
    expect(user.password_hash).not.toBe(VALID_PASSWORD);
  });

  test('CP-UNI-02 rechaza un nombre vacío', async () => {
    const res = await register(app, { nombre_completo: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Todos los campos son obligatorios.');
    expect(await User.count()).toBe(0);
  });

  test('CP-UNI-02 rechaza un nombre de más de 50 caracteres', async () => {
    const res = await register(app, { nombre_completo: 'a'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El nombre completo no puede exceder 50 caracteres.');
    expect(await User.count()).toBe(0);
  });

  test('CP-UNI-03 rechaza un teléfono ya registrado', async () => {
    await register(app);

    const res = await register(app, {
      correo_institucional: 'otra@correo.uady.mx',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('El teléfono ya está registrado.');
    expect(await User.count()).toBe(1);
  });

  test('CP-UNI-04 rechaza un teléfono con formato incorrecto', async () => {
    for (const telefono of ['12345', 'abcdefghij', '12345678901', '987654321']) {
      const res = await register(app, { telefono });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('El teléfono debe tener 10 dígitos.');
    }
    expect(await User.count()).toBe(0);
  });

  test('CP-UNI-04 acepta un teléfono con separadores', async () => {
    const res = await register(app, { telefono: '987-654-3210' });

    expect(res.status).toBe(201);

    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    expect(user.telefono).toBe(VALID_PHONE);
  });

  test('CP-UNI-05 rechaza un correo institucional ya registrado', async () => {
    await register(app);

    const res = await register(app, { telefono: '1234567890' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('El correo institucional ya está registrado.');
    expect(await User.count()).toBe(1);
  });

  test('CP-UNI-05 detecta el duplicado sin distinguir mayúsculas', async () => {
    await register(app);

    const res = await register(app, {
      correo_institucional: `  ${VALID_EMAIL.toUpperCase()} `,
      telefono: '1234567890',
    });

    expect(res.status).toBe(409);
  });

  test('CP-UNI-06 rechaza un correo que no cumple el formato institucional UADY', async () => {
    const invalidos = [
      'ana@gmail.com',
      'ana@psicogestion.com',
      'no-es-correo',
      'ana@xuady.mx',
      'ana@uady.mx.evil.com',
    ];

    for (const correo_institucional of invalidos) {
      const res = await register(app, { correo_institucional });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('El correo debe ser institucional de la UADY (@…uady.mx).');
    }
    expect(await User.count()).toBe(0);
  });

  test('CP-UNI-06 acepta cualquier subdominio de uady.mx', async () => {
    const validos = ['ana@uady.mx', 'ana@correo.uady.mx', 'ana@alumni.uady.mx'];

    for (let i = 0; i < validos.length; i += 1) {
      const res = await register(app, {
        correo_institucional: validos[i],
        telefono: `987654321${i}`,
      });
      expect(res.status).toBe(201);
    }
  });

  test('CP-UNI-09 rechaza contraseñas con formato inválido', async () => {
    const invalidas = [
      'Ab1!',
      'Abcdefg!',
      'abcdefgh1!',
      'Abcdefg123',
      `${'A'.repeat(26)}1!`,
    ];

    for (const password of invalidas) {
      const res = await register(app, { password, confirmar_password: password });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
    expect(await User.count()).toBe(0);
  });

  test('CP-UNI-10 rechaza contraseñas que no coinciden', async () => {
    const res = await register(app, {
      password: VALID_PASSWORD,
      confirmar_password: 'OtraClave123!',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La contraseña y la confirmación no coinciden.');
    expect(await User.count()).toBe(0);
  });

  test('rechaza el envío con campos obligatorios ausentes', async () => {
    const res = await request(app).post('/api/auth/registro').send({
      nombre_completo: 'Ana López',
      telefono: VALID_PHONE,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Todos los campos son obligatorios.');
  });
});
