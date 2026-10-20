const service = require('./citas.service');
const { contextoDe } = require('../../lib/audit');

const manejar = (accion, mensaje, estado = 200) => async (req, res, next) => {
  try {
    const data = await accion(req);

    res.status(estado).json({ success: true, message: mensaje, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  crear: manejar((req) => service.crear(req.validated.body, contextoDe(req)), 'Cita agendada correctamente.', 201),
  listar: manejar((req) => service.listar(req.validated.query), 'Citas consultadas correctamente.'),
  disponibilidad: manejar(
    (req) => service.disponibilidad(req.validated.query),
    'Disponibilidad consultada correctamente.'
  ),
  obtener: manejar((req) => service.obtener(req.validated.params.id, contextoDe(req)), 'Cita consultada correctamente.'),
  obtenerPorFolio: manejar(
    (req) => service.obtenerPorFolio(req.validated.params.folio, contextoDe(req)),
    'Cita consultada correctamente.'
  ),
  actualizar: manejar(
    (req) => service.actualizar(req.validated.params.id, req.validated.body, contextoDe(req)),
    'Cita actualizada correctamente.'
  ),
  cancelar: manejar(
    (req) => service.cancelar({ id: req.validated.params.id }, req.validated.body, contextoDe(req)),
    'Cita cancelada correctamente.'
  ),
  cancelarPorFolio: manejar(
    (req) => service.cancelar({ folio: req.validated.params.folio }, req.validated.body, contextoDe(req)),
    'Cita cancelada correctamente.'
  ),
  reenviarConfirmacion: manejar(
    (req) => service.reenviarConfirmacion(req.validated.params.id, contextoDe(req)),
    'La confirmación se enviará en unos momentos.'
  ),
};
