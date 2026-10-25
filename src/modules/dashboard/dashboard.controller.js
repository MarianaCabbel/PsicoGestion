const service = require('./dashboard.service');

module.exports = {
  resumen: async (req, res, next) => {
    try {
      const data = await service.resumen();
      res.status(200).json({ success: true, message: 'Resumen consultado correctamente.', data });
    } catch (error) {
      next(error);
    }
  },
};
