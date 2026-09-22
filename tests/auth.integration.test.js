const request = require('supertest');
const { sequelize, User } = require('../src/config/database');
const app = require('../src/app');

describe('Flujos de autenticación', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await User.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('registro -> verificación -> login -> logout', async () => {
    const registro = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre_completo: 'Ana López',
        correo_institucional: 'ana@psicogestion.com',
        telefono: '987654321',
        password: 'Password123!',
        confirmar_password: 'Password123!',
      });

    expect(registro.status).toBe(201);
    expect(registro.body.success).toBe(true);

    const user = await User.findOne({ where: { correo_institucional: 'ana@psicogestion.com' } });
    expect(user.verificado).toBe(false);

    const verification = await request(app)
      .post('/api/auth/verificar')
      .send({
        correo_institucional: 'ana@psicogestion.com',
        codigo_verificacion: user.codigo_verificacion,
      });

    expect(verification.status).toBe(200);
    expect(verification.body.success).toBe(true);

    await user.reload();
    expect(user.verificado).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        correo_institucional: 'ana@psicogestion.com',
        password: 'Password123!',
      });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(login.body.data.token).toBeTruthy();

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);
  });

  test('recuperación -> restablecimiento', async () => {
    await User.create({
      nombre_completo: 'Luis Pérez',
      correo_institucional: 'luis@psicogestion.com',
      telefono: '123456789',
      password_hash: '$2b$10$9e2o6v4P7lqZAZD4bR9UYeq1G1YyevV4vR.Q3dR3lPTd2XxKHVxG6',
      verificado: true,
    });

    const recover = await request(app)
      .post('/api/auth/recuperar')
      .send({ correo_institucional: 'luis@psicogestion.com' });

    expect(recover.status).toBe(200);
    expect(recover.body.success).toBe(true);

    const token = recover.body.data.token;
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/restablecer')
      .send({
        token,
        nueva_password: 'NuevaClave2024!',
        confirmar_password: 'NuevaClave2024!',
      });

    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);
  });
});
