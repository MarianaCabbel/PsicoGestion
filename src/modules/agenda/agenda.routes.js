const express = require('express');
const controller = require('./agenda.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { consultaAgenda } = require('./agenda.validators');

const router = express.Router();
router.use(authenticateToken);
router.get(
  '/',
  requirePermission('citas:leer'),
  validate({ query: consultaAgenda }),
  controller.consultar,
);

module.exports = router;
