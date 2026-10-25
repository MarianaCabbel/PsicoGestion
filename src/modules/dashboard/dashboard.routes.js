const express = require('express');
const controller = require('./dashboard.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');

const router = express.Router();
router.use(authenticateToken);
router.get('/resumen', requirePermission('citas:leer'), controller.resumen);

module.exports = router;
