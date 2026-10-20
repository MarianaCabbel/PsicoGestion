const express = require('express');
const multer = require('multer');
const controller = require('./terapeutas.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/requireRole');
const { validate } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { FOTO_MAX_BYTES } = require('../../config/clinica');
const { idParams, confirmacionBody } = require('../comun.validators');
const {
  crearTerapeutaSchema,
  actualizarTerapeutaSchema,
  listarTerapeutasQuery,
  reemplazarHorariosBody,
} = require('./terapeutas.validators');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FOTO_MAX_BYTES, files: 1 },
}).single('foto');

/** Traduce los errores de multer a respuestas 400 con el formato de la API. */
function recibirFoto(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const mensaje =
        error.code === 'LIMIT_FILE_SIZE'
          ? `La foto no puede pesar más de ${FOTO_MAX_BYTES / (1024 * 1024)} MB.`
          : 'No se pudo procesar el archivo enviado.';
      return next(new AppError(mensaje, 400, null, { foto: mensaje }));
    }

    return next(error);
  });
}

router.use(authenticateToken);

router.get('/', requirePermission('terapeutas:leer'), validate({ query: listarTerapeutasQuery }), controller.listar);

router.post('/', requirePermission('terapeutas:crear'), validate({ body: crearTerapeutaSchema }), controller.crear);

router.get('/:id', requirePermission('terapeutas:leer'), validate({ params: idParams }), controller.obtener);

router.put(
  '/:id',
  requirePermission('terapeutas:editar'),
  validate({ params: idParams, body: actualizarTerapeutaSchema }),
  controller.actualizar
);

router.delete(
  '/:id',
  requirePermission('terapeutas:baja'),
  validate({ params: idParams, body: confirmacionBody }),
  controller.darDeBaja
);

router.post(
  '/:id/reactivar',
  requirePermission('terapeutas:reactivar'),
  validate({ params: idParams }),
  controller.reactivar
);

router.put(
  '/:id/foto',
  requirePermission('terapeutas:editar'),
  validate({ params: idParams }),
  recibirFoto,
  controller.subirFoto
);

router.get('/:id/foto', requirePermission('terapeutas:leer'), validate({ params: idParams }), controller.verFoto);

router.get(
  '/:id/horarios',
  requirePermission('terapeutas:leer'),
  validate({ params: idParams }),
  controller.obtenerHorarios
);

router.put(
  '/:id/horarios',
  requirePermission('terapeutas:editar'),
  validate({ params: idParams, body: reemplazarHorariosBody }),
  controller.reemplazarHorarios
);

module.exports = router;
