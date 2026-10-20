const express = require('express');
const controller = require('./pacientes.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { idParams, confirmacionBody } = require('../comun.validators');
const {
  crearPacienteSchema,
  actualizarPacienteSchema,
  listarPacientesQuery,
  consentimientoBody,
} = require('./pacientes.validators');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('pacientes:leer'), validate({ query: listarPacientesQuery }), controller.listar);

router.post('/', requirePermission('pacientes:crear'), validate({ body: crearPacienteSchema }), controller.crear);

router.get('/:id', requirePermission('pacientes:leer'), validate({ params: idParams }), controller.obtener);

router.put(
  '/:id',
  requirePermission('pacientes:editar'),
  validate({ params: idParams, body: actualizarPacienteSchema }),
  controller.actualizar
);

router.delete(
  '/:id',
  requirePermission('pacientes:baja'),
  validate({ params: idParams, body: confirmacionBody }),
  controller.darDeBaja
);

router.post(
  '/:id/reactivar',
  requirePermission('pacientes:reactivar'),
  validate({ params: idParams }),
  controller.reactivar
);

router.post(
  '/:id/consentimiento',
  requirePermission('pacientes:consentimiento'),
  validate({ params: idParams, body: consentimientoBody }),
  controller.registrarConsentimiento
);

module.exports = router;
