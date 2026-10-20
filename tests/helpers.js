const request = require('supertest');
const bcrypt = require('bcrypt');
const {
  sequelize,
  User,
  Paciente,
  Terapeuta,
  TerapeutaFoto,
  TerapeutaHorario,
  AuditLog,
  CorreoAutorizado,
  Sala,
  Cita,
  CitaOcupacion,
  FolioCounter,
  Notificacion,
} = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { RESET_LINK_TTL_MS } = require('../src/utils/authHelpers');
const { testOutbox, testControl } = require('../src/utils/email');

const VALID_EMAIL = 'ana@correo.uady.mx';
const VALID_PHONE = '9876543210';
const VALID_PASSWORD = 'Password123!';

/**
 * Registra los hooks de la base de datos en memoria para el suite actual.
 * Debe llamarse dentro de un bloque describe.
 */
function useTestDatabase() {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await limpiarTablas();
    testOutbox.length = 0;
    testControl.fallar = false;
    testControl.mensaje = null;
    reloj.fijarAhora(null);
  });

  afterAll(async () => {
    await sequelize.close();
  });
}

/** Vacía todas las tablas respetando el orden de las llaves foráneas. */
async function limpiarTablas() {
  await Notificacion.destroy({ where: {} });
  await CitaOcupacion.destroy({ where: {} });
  await Cita.destroy({ where: {} });
  await FolioCounter.destroy({ where: {} });
  await AuditLog.destroy({ where: {}, force: true });
  await TerapeutaHorario.destroy({ where: {} });
  await TerapeutaFoto.destroy({ where: {} });
  await Terapeuta.destroy({ where: {}, force: true });
  await Paciente.destroy({ where: {}, force: true });
  await Sala.destroy({ where: {}, force: true });
  await CorreoAutorizado.destroy({ where: {} });
  await User.destroy({ where: {} });
}

/** Último token de recuperación enviado por correo (en la base solo existe su huella). */
function ultimoTokenRecuperacion(correo = VALID_EMAIL) {
  const envio = [...testOutbox].reverse().find((e) => e.tipo === 'recuperacion' && e.to === correo);
  return envio ? envio.token : null;
}

async function seedVerifiedUser({ password = VALID_PASSWORD, ...overrides } = {}) {
  const password_hash = await bcrypt.hash(password, 10);

  return User.create({
    nombre_completo: 'Ana López',
    correo_institucional: VALID_EMAIL,
    telefono: VALID_PHONE,
    password_hash,
    verificado: true,
    token_version: 0,
    ...overrides,
  });
}

function register(app, overrides = {}) {
  return request(app).post('/api/auth/registro').send({
    nombre_completo: 'Ana López',
    correo_institucional: VALID_EMAIL,
    telefono: VALID_PHONE,
    password: VALID_PASSWORD,
    confirmar_password: VALID_PASSWORD,
    ...overrides,
  });
}

async function loginAndToken(app) {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ correo_institucional: VALID_EMAIL, password: VALID_PASSWORD });

  return login.body.data.token;
}

/** Crea un usuario verificado con el rol dado, inicia sesión y devuelve el token. */
async function loginAs(app, rol = 'secretaria', overrides = {}) {
  await seedVerifiedUser({ rol, ...overrides });
  return loginAndToken(app);
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  limpiarTablas,
  ultimoTokenRecuperacion,
  loginAs,
  bearer,
  VALID_EMAIL,
  VALID_PHONE,
  VALID_PASSWORD,
  RESET_LINK_TTL_MS,
  useTestDatabase,
  seedVerifiedUser,
  register,
  loginAndToken,
};
