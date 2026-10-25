const service = require('./admin.service');
const { contextoDe } = require('../../lib/audit');

async function listarCorreos(req, res, next) {
  try {
    const data = await service.listarCorreos(req.validated.query);
    res.status(200).json({ success: true, message: 'Correos autorizados consultados.', data });
  } catch (error) {
    next(error);
  }
}

async function autorizarCorreo(req, res, next) {
  try {
    const data = await service.autorizarCorreo(req.validated.body.correo, contextoDe(req));
    res.status(201).json({ success: true, message: 'Correo autorizado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

async function revocarCorreo(req, res, next) {
  try {
    await service.revocarCorreo(req.validated.params.id, contextoDe(req));
    res.status(200).json({ success: true, message: 'Acceso revocado correctamente.' });
  } catch (error) {
    next(error);
  }
}

async function listarUsuarios(req, res, next) {
  try {
    const data = await service.listarUsuarios(req.validated.query);
    res.status(200).json({ success: true, message: 'Usuarios consultados correctamente.', data });
  } catch (error) {
    next(error);
  }
}

async function cambiarRol(req, res, next) {
  try {
    const data = await service.cambiarRol(
      req.validated.params.id,
      req.validated.body.rol,
      contextoDe(req),
    );
    res.status(200).json({ success: true, message: 'Rol actualizado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

module.exports = { listarCorreos, autorizarCorreo, revocarCorreo, listarUsuarios, cambiarRol };
