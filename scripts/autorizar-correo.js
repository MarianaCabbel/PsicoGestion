require('dotenv').config();

const { sequelize, CorreoAutorizado } = require('../src/config/database');
const { isInstitutionalEmail, normalizeEmail } = require('../src/utils/authHelpers');

/**
 * Uso: node scripts/autorizar-correo.js correo@uady.mx [--revocar]
 * Da de alta (o revoca) un correo en la lista blanca de registro.
 */
async function main() {
  const [correoArg, bandera] = process.argv.slice(2);

  if (!correoArg) {
    throw new Error('Indica el correo a autorizar. Ejemplo: npm run usuarios:autorizar -- ana@correo.uady.mx');
  }

  const correo = normalizeEmail(correoArg);

  if (!isInstitutionalEmail(correo)) {
    throw new Error('El correo debe ser institucional (@…uady.mx o un dominio autorizado).');
  }

  await sequelize.authenticate();

  const [registro] = await CorreoAutorizado.findOrCreate({ where: { correo }, defaults: { activo: true } });
  registro.activo = bandera !== '--revocar';
  await registro.save();

  console.log(`${correo}: ${registro.activo ? 'autorizado' : 'autorización revocada'}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
