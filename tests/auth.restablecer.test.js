const request = require('supertest');
const bcrypt = require('bcrypt');
const { User } = require('../src/config/database');
const app = require('../src/app');
const {
  VALID_EMAIL,
  VALID_PASSWORD,
  useTestDatabase,
  seedVerifiedUser,
  ultimoTokenRecuperacion,
} = require('./helpers');

async function solicitarToken() {
  await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });
  const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
  return user;
}

function restablecer(overrides = {}) {
  return request(app).post('/api/auth/restablecer').send({
    token: 'token-de-prueba',
    nueva_password: 'NuevaClave2024!',
    confirmar_password: 'NuevaClave2024!',
    ...overrides,
  });
}

describe('Restablecimiento de contraseña', () => {
  useTestDatabase();

  test('CP-UNI-27 el enlace caducado ya no permite restablecer la contraseña', async () => {
    await seedVerifiedUser();
    const user = await solicitarToken();
    const hashAnterior = user.password_hash;

    user.reset_token_expira_en = new Date(Date.now() - 1000);
    await user.save();

    const res = await restablecer({ token: ultimoTokenRecuperacion() });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('El token de restablecimiento es inválido o ha expirado.');

    await user.reload();
    expect(user.password_hash).toBe(hashAnterior);
    expect(await bcrypt.compare(VALID_PASSWORD, user.password_hash)).toBe(true);
  });

  test('CP-UNI-27 el enlace vigente tiene una vida de 10 minutos', async () => {
    await seedVerifiedUser();
    const user = await solicitarToken();

    const restante = user.reset_token_expira_en.getTime() - Date.now();
    expect(restante).toBeGreaterThan(0);
    expect(restante).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  test('CP-UNI-28 restablecimiento exitoso, cifrado y confirmado', async () => {
    await seedVerifiedUser();
    const user = await solicitarToken();
    const hashAnterior = user.password_hash;

    const inicio = Date.now();
    const res = await restablecer({ token: ultimoTokenRecuperacion() });
    const transcurrido = Date.now() - inicio;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Contraseña restablecida correctamente.');
    expect(transcurrido).toBeLessThan(2000);

    await user.reload();
    expect(user.password_hash).not.toBe('NuevaClave2024!');
    expect(user.password_hash).not.toBe(hashAnterior);
    expect(user.password_hash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('NuevaClave2024!', user.password_hash)).toBe(true);
    expect(await bcrypt.compare(VALID_PASSWORD, user.password_hash)).toBe(false);
    expect(user.reset_token_hash).toBeNull();
    expect(user.reset_token_expira_en).toBeNull();
  });

  test('CP-UNI-29 una contraseña inválida no se almacena ni consume el enlace', async () => {
    await seedVerifiedUser();
    const user = await solicitarToken();
    const hashAnterior = user.password_hash;
    const tokenAnterior = ultimoTokenRecuperacion();
    const huellaAnterior = user.reset_token_hash;

    for (const nueva_password of ['Ab1!', 'abcdefgh1!', 'Abcdefg123']) {
      const res = await restablecer({
        token: tokenAnterior,
        nueva_password,
        confirmar_password: nueva_password,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }

    await user.reload();
    expect(user.password_hash).toBe(hashAnterior);
    expect(user.reset_token_hash).toBe(huellaAnterior);
    expect(await bcrypt.compare(VALID_PASSWORD, user.password_hash)).toBe(true);
  });

  test('CP-UNI-29 rechaza la confirmación que no coincide con la contraseña', async () => {
    await seedVerifiedUser();
    const user = await solicitarToken();
    const hashAnterior = user.password_hash;

    const res = await restablecer({
      token: ultimoTokenRecuperacion(),
      confirmar_password: 'OtraClave2024!',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La nueva contraseña y la confirmación no coinciden.');

    await user.reload();
    expect(user.password_hash).toBe(hashAnterior);
  });

  test('rechaza un token desconocido', async () => {
    await seedVerifiedUser();

    const res = await restablecer({ token: 'token-que-no-existe' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El token de restablecimiento es inválido o ha expirado.');
  });

  test('rechaza el envío con campos obligatorios ausentes', async () => {
    const res = await request(app).post('/api/auth/restablecer').send({ token: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token, nueva contraseña y confirmación son obligatorios.');
  });
});
