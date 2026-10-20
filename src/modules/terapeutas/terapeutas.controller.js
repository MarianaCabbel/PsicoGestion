const service = require('./terapeutas.service');
const { contextoDe } = require('../../lib/audit');

async function crear(req, res, next) {
  try {
    const terapeuta = await service.crear(req.validated.body, contextoDe(req));

    res.status(201).json({ success: true, message: 'Terapeuta registrado correctamente.', data: terapeuta });
  } catch (error) {
    next(error);
  }
}

async function listar(req, res, next) {
  try {
    const data = await service.listar(req.validated.query);

    res.status(200).json({ success: true, message: 'Terapeutas consultados correctamente.', data });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const terapeuta = await service.obtener(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Terapeuta consultado correctamente.', data: terapeuta });
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const terapeuta = await service.actualizar(req.validated.params.id, req.validated.body, contextoDe(req));

    res.status(200).json({ success: true, message: 'Terapeuta actualizado correctamente.', data: terapeuta });
  } catch (error) {
    next(error);
  }
}

async function darDeBaja(req, res, next) {
  try {
    await service.darDeBaja(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Terapeuta dado de baja correctamente.' });
  } catch (error) {
    next(error);
  }
}

async function reactivar(req, res, next) {
  try {
    const terapeuta = await service.reactivar(req.validated.params.id, contextoDe(req));

    res.status(200).json({ success: true, message: 'Terapeuta reactivado correctamente.', data: terapeuta });
  } catch (error) {
    next(error);
  }
}

async function subirFoto(req, res, next) {
  try {
    const data = await service.guardarFoto(req.validated.params.id, req.file, contextoDe(req));

    res.status(200).json({ success: true, message: 'Foto actualizada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

async function verFoto(req, res, next) {
  try {
    const foto = await service.obtenerFoto(req.validated.params.id);

    res
      .status(200)
      .set({
        'Content-Type': foto.mime,
        'Content-Length': foto.data.length,
        'Cache-Control': 'private, max-age=300',
      })
      .send(foto.data);
  } catch (error) {
    next(error);
  }
}

async function obtenerHorarios(req, res, next) {
  try {
    const horarios = await service.obtenerHorarios(req.validated.params.id);

    res.status(200).json({ success: true, message: 'Horarios consultados correctamente.', data: { horarios } });
  } catch (error) {
    next(error);
  }
}

async function reemplazarHorarios(req, res, next) {
  try {
    const horarios = await service.reemplazarHorarios(
      req.validated.params.id,
      req.validated.body.horarios,
      contextoDe(req),
      { confirmarConflictos: req.validated.body.confirmar_conflictos }
    );

    res.status(200).json({ success: true, message: 'Horarios actualizados correctamente.', data: { horarios } });
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
  subirFoto,
  verFoto,
  obtenerHorarios,
  reemplazarHorarios,
};
