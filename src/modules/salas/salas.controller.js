const service = require('./salas.service');
const { contextoDe } = require('../../lib/audit');

const manejar = (accion, mensaje, estado = 200) => async (req, res, next) => {
  try {
    const data = await accion(req);
    const respuesta = { success: true, message: mensaje };

    if (data !== undefined) respuesta.data = data;

    res.status(estado).json(respuesta);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  crear: manejar((req) => service.crear(req.validated.body, contextoDe(req)), 'Sala registrada correctamente.', 201),
  listar: manejar((req) => service.listar(req.validated.query), 'Salas consultadas correctamente.'),
  obtener: manejar((req) => service.obtener(req.validated.params.id, contextoDe(req)), 'Sala consultada correctamente.'),
  darDeBaja: manejar((req) => service.darDeBaja(req.validated.params.id, contextoDe(req)), 'Sala dada de baja correctamente.'),
  reactivar: manejar((req) => service.reactivar(req.validated.params.id, contextoDe(req)), 'Sala reactivada correctamente.'),
  disponibilidadDelDia: manejar(
    (req) => service.disponibilidadDelDia(req.validated.query.fecha),
    'Disponibilidad consultada correctamente.'
  ),
  disponibilidadDeRango: manejar(
    (req) => service.disponibilidadDeRango(req.validated.params.id, req.validated.query),
    'Disponibilidad consultada correctamente.'
  ),
};
