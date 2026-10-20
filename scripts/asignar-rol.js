require('dotenv').config();

const { sequelize, User } = require('../src/config/database');
const { normalizeEmail } = require('../src/utils/authHelpers');

/** Uso: node scripts/asignar-rol.js correo@uady.mx secretaria|administrador */
async function main() {
  const [correoArg, rol] = process.argv.slice(2);

  if (!correoArg || !['secretaria', 'administrador'].includes(rol)) {
    throw new Error('Uso: npm run usuarios:rol -- correo@uady.mx secretaria|administrador');
  }

  await sequelize.authenticate();

  const user = await User.findOne({ where: { correo_institucional: normalizeEmail(correoArg) } });

  if (!user) {
    throw new Error('No existe un usuario con ese correo.');
  }

  user.rol = rol;
  // Cerrar las sesiones abiertas obliga a que el nuevo rol se aplique de inmediato.
  user.token_version += 1;
  await user.save();

  console.log(`${user.correo_institucional}: rol ${rol}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
