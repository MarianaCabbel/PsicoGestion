const express = require('express');
const controller = require('./salas.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { idParams, confirmacionBody } = require('../comun.validators');
const {
  crearSalaSchema,
  listarSalasQuery,
  disponibilidadDiaQuery,
  disponibilidadRangoQuery,
} = require('./salas.validators');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('salas:leer'), validate({ query: listarSalasQuery }), controller.listar);

router.post('/', requirePermission('salas:crear'), validate({ body: crearSalaSchema }), controller.crear);

// Rutas fijas antes de /:id para que "disponibilidad" no se interprete como un identificador.
router.get(
  '/disponibilidad',
  requirePermission('salas:leer'),
  validate({ query: disponibilidadDiaQuery }),
  controller.disponibilidadDelDia
);

router.get('/:id', requirePermission('salas:leer'), validate({ params: idParams }), controller.obtener);

router.get(
  '/:id/disponibilidad',
  requirePermission('salas:leer'),
  validate({ params: idParams, query: disponibilidadRangoQuery }),
  controller.disponibilidadDeRango
);

router.delete(
  '/:id',
  requirePermission('salas:baja'),
  validate({ params: idParams, body: confirmacionBody }),
  controller.darDeBaja
);

router.post(
  '/:id/reactivar',
  requirePermission('salas:reactivar'),
  validate({ params: idParams }),
  controller.reactivar
);

module.exports = router;
