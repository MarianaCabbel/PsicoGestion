const express = require('express');
const controller = require('./auditoria.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requireRole } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { consultarAuditoriaQuery } = require('./auditoria.validators');

const router = express.Router();
router.use(authenticateToken, requireRole('administrador'));
router.get('/', validate({ query: consultarAuditoriaQuery }), controller.listar);

module.exports = router;
