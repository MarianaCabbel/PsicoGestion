module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pacientes', 'anonimizado_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pacientes', 'anonimizado_at');
  },
};
