const request = require('supertest');
const { Op } = require('sequelize');
const { User } = require('../src/config/database');
const app = require('../src/app');
const { VALID_EMAIL, RESET_LINK_TTL_MS, useTestDatabase, seedVerifiedUser } = require('./helpers');

function recuperar(overrides = {}) {
  return request(app).post('/api/auth/recuperar').send({
    correo_institucional: VALID_EMAIL,
    ...overrides,
  });
}

describe('Recuperación de cuenta', () => {
  useTestDatabase();

  test('CP-UNI-24 recuperación exitosa con correo registrado en menos de 2 minutos', async () => {
    await seedVerifiedUser();

    const inicio = Date.now();
    const res = await recuperar();
    const transcurrido = Date.now() - inicio;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(transcurrido).toBeLessThan(120000);

    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    expect(user.reset_token_hash).toBeTruthy();
    expect(user.reset_token_expira_en.getTime()).toBeGreaterThan(Date.now());
    expect(user.reset_token_expira_en.getTime() - Date.now()).toBeLessThanOrEqual(RESET_LINK_TTL_MS);
  });

  test('CP-UNI-25 rechaza un correo con formato no institucional y no envía el enlace', async () => {
    await seedVerifiedUser();

    const res = await recuperar({ correo_institucional: 'ana@gmail.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('El correo debe ser institucional de la UADY (@…uady.mx).');

    const conToken = await User.findOne({ where: { reset_token_hash: { [Op.ne]: null } } });
    expect(conToken).toBeNull();
  });

  test('CP-UNI-25 rechaza un correo vacío', async () => {
    const res = await recuperar({ correo_institucional: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El correo institucional es obligatorio.');
  });

  test('CP-UNI-26 la respuesta es idéntica con correo registrado y no registrado', async () => {
    await seedVerifiedUser();

    const registrado = await recuperar();
    const inexistente = await recuperar({ correo_institucional: 'nadie@correo.uady.mx' });

    expect(registrado.status).toBe(200);
    expect(inexistente.status).toBe(200);
    expect(inexistente.body.message).toBe(registrado.body.message);
    expect(inexistente.body.success).toBe(registrado.body.success);
    expect(inexistente.body.data).toBeUndefined();
    expect(registrado.body.data).toBeUndefined();
  });

  test('CP-UNI-26 no revela el token de restablecimiento en la respuesta', async () => {
    await seedVerifiedUser();

    const res = await recuperar();

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('reset_token');
    expect(res.body.data).toBeUndefined();
  });

  test('CP-UNI-26 no guarda token cuando el correo no está registrado', async () => {
    await seedVerifiedUser();

    await recuperar({ correo_institucional: 'nadie@correo.uady.mx' });

    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    expect(user.reset_token_hash).toBeNull();
    expect(user.reset_token_expira_en).toBeNull();
  });
});
