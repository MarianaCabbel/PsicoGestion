const service = require('./pacientes.service');
const { contextoDe } = require('../../lib/audit');

async function crear(req, res, next) {
  try {
    const paciente = await service.crear(req.validated.body, contextoDe(req));

    res.status(201).json({ success: true, message: 'Paciente registrado correctamente.', data: paciente });
  } catch (error) {
    next(error);
  }
}

async function listar(req, res, next) {
  try {
    const data = await service.listar(req.validated.query);

    res.status(200).json({ success: true, message: 'Pacientes consultados correctamente.', data });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const paciente = await service.obtener(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Paciente consultado correctamente.', data: paciente });
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const paciente = await service.actualizar(req.validated.params.id, req.validated.body, contextoDe(req));

    res.status(200).json({ success: true, message: 'Paciente actualizado correctamente.', data: paciente });
  } catch (error) {
    next(error);
  }
}

async function darDeBaja(req, res, next) {
  try {
    await service.darDeBaja(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Paciente dado de baja correctamente.' });
  } catch (error) {
    next(error);
  }
}

async function reactivar(req, res, next) {
  try {
    const paciente = await service.reactivar(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Paciente reactivado correctamente.', data: paciente });
  } catch (error) {
    next(error);
  }
}

async function registrarConsentimiento(req, res, next) {
  try {
    const paciente = await service.registrarConsentimiento(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Consentimiento registrado correctamente.', data: paciente });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crear,
  listar,
  obtener,
  actualizar,
  darDeBaja,
  reactivar,
  registrarConsentimiento,
};
