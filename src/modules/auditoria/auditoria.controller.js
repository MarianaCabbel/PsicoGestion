const service = require('./auditoria.service');

async function listar(req, res, next) {
  try {
    const data = await service.listar(req.validated.query);
    res.status(200).json({ success: true, message: 'Bitácora consultada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar };
