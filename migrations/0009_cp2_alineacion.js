/**
 * Alineación con los casos de prueba CP2:
 *  - nombre_completo limitado a 50 caracteres en pacientes y terapeutas.
 *  - el teléfono del terapeuta es único (como el correo y la cédula);
 *    el teléfono del paciente sigue sin serlo (una familia puede compartir línea).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('pacientes', 'nombre_completo', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });

    await queryInterface.changeColumn('terapeutas', 'nombre_completo', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });

    await queryInterface.addIndex('terapeutas', ['telefono'], {
      unique: true,
      name: 'terapeutas_telefono_unico_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('terapeutas', 'terapeutas_telefono_unico_idx');

    await queryInterface.changeColumn('terapeutas', 'nombre_completo', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    await queryInterface.changeColumn('pacientes', 'nombre_completo', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
  },
};
