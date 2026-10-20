const express = require('express');
const controller = require('./citas.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { idParams } = require('../comun.validators');
const {
  crearCitaSchema,
  actualizarCitaSchema,
  folioParams,
  cancelarBody,
  listarCitasQuery,
  disponibilidadCitasQuery,
} = require('./citas.validators');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('citas:leer'), validate({ query: listarCitasQuery }), controller.listar);

router.post('/', requirePermission('citas:crear'), validate({ body: crearCitaSchema }), controller.crear);

// Rutas fijas antes de /:id para que "disponibilidad" y "folio" no se lean como identificadores.
router.get(
  '/disponibilidad',
  requirePermission('citas:leer'),
  validate({ query: disponibilidadCitasQuery }),
  controller.disponibilidad
);

router.get('/folio/:folio', requirePermission('citas:leer'), validate({ params: folioParams }), controller.obtenerPorFolio);

router.post(
  '/folio/:folio/cancelar',
  requirePermission('citas:cancelar'),
  validate({ params: folioParams, body: cancelarBody }),
  controller.cancelarPorFolio
);

router.get('/:id', requirePermission('citas:leer'), validate({ params: idParams }), controller.obtener);

router.put(
  '/:id',
  requirePermission('citas:editar'),
  validate({ params: idParams, body: actualizarCitaSchema }),
  controller.actualizar
);

router.post(
  '/:id/cancelar',
  requirePermission('citas:cancelar'),
  validate({ params: idParams, body: cancelarBody }),
  controller.cancelar
);

router.post(
  '/:id/reenviar-confirmacion',
  requirePermission('citas:editar'),
  validate({ params: idParams }),
  controller.reenviarConfirmacion
);

module.exports = router;
