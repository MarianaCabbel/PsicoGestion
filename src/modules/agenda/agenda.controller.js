const service = require('./agenda.service');

module.exports = {
  consultar: async (req, res, next) => {
    try {
      const data = await service.consultar(req.validated.query);
      res.status(200).json({ success: true, message: 'Agenda consultada correctamente.', data });
    } catch (error) {
      next(error);
    }
  },
};
