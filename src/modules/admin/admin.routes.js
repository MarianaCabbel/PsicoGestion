const express = require('express');
const controller = require('./admin.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requireRole } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { idParams } = require('../comun.validators');
const { listarQuery, correoBody, cambiarRolBody } = require('./admin.validators');

const router = express.Router();
router.use(authenticateToken, requireRole('administrador'));

router.get('/correos-autorizados', validate({ query: listarQuery }), controller.listarCorreos);
router.post('/correos-autorizados', validate({ body: correoBody }), controller.autorizarCorreo);
router.delete('/correos-autorizados/:id', validate({ params: idParams }), controller.revocarCorreo);
router.get('/usuarios', validate({ query: listarQuery }), controller.listarUsuarios);
router.put(
  '/usuarios/:id/rol',
  validate({ params: idParams, body: cambiarRolBody }),
  controller.cambiarRol,
);

module.exports = router;
