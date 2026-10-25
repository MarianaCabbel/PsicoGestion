const { User, CorreoAutorizado } = require('../../config/database');
const { AppError } = require('../../utils/errors');
const { registrarAuditoria } = require('../../lib/audit');
const { conTransaccion } = require('../../lib/transaccion');
const { calcularPaginacion, respuestaPaginada } = require('../../lib/paginacion');

function serializarUsuario(user) {
  return {
    id: user.id,
    nombre_completo: user.nombre_completo,
    correo_institucional: user.correo_institucional,
    telefono: user.telefono,
    rol: user.rol,
    verificado: user.verificado,
    fecha_creacion: user.fecha_creacion,
  };
}

async function listarCorreos(query) {
  const paginacion = calcularPaginacion(query);
  const { rows, count } = await CorreoAutorizado.findAndCountAll({
    attributes: ['id', 'correo', 'activo', 'created_at'],
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });
  return respuestaPaginada(rows, count, paginacion);
}

async function autorizarCorreo(correo, contexto) {
  return conTransaccion(async (transaction) => {
    const [registro, creado] = await CorreoAutorizado.findOrCreate({
      where: { correo },
      defaults: { correo, activo: true },
      transaction,
    });
    if (!creado) {
      if (!registro.activo) {
        await registro.update({ activo: true }, { transaction });
      } else {
        throw new AppError('El correo ya está autorizado.', 409);
      }
    }
    await registrarAuditoria(
      {
        ...contexto,
        accion: creado ? 'autorizar_correo' : 'reactivar_correo',
        entidad: 'correo_autorizado',
        entidadId: registro.id,
        detalle: { campos: ['correo', 'estado'] },
      },
      { transaction },
    );
    return { id: registro.id, correo: registro.correo, activo: registro.activo };
  });
}

async function revocarCorreo(id, contexto) {
  return conTransaccion(async (transaction) => {
    const registro = await CorreoAutorizado.findByPk(id, { transaction });
    if (!registro) throw new AppError('El correo autorizado no existe.', 404);

    await registro.destroy({ transaction });
    await registrarAuditoria(
      {
        ...contexto,
        accion: 'revocar_correo',
        entidad: 'correo_autorizado',
        entidadId: id,
        detalle: { campos: ['correo', 'estado'] },
      },
      { transaction },
    );
  });
}

async function listarUsuarios(query) {
  const paginacion = calcularPaginacion(query);
  const { rows, count } = await User.findAndCountAll({
    attributes: [
      'id',
      'nombre_completo',
      'correo_institucional',
      'telefono',
      'rol',
      'verificado',
      'fecha_creacion',
    ],
    order: [
      ['fecha_creacion', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });
  return respuestaPaginada(rows, count, paginacion);
}

async function cambiarRol(id, rol, contexto) {
  return conTransaccion(async (transaction) => {
    const usuario = await User.findByPk(id, { transaction });
    if (!usuario) throw new AppError('El usuario no existe.', 404);
    if (usuario.rol === rol) return serializarUsuario(usuario);

    await usuario.update({ rol, token_version: usuario.token_version + 1 }, { transaction });
    await registrarAuditoria(
      {
        ...contexto,
        accion: 'cambiar_rol',
        entidad: 'usuario',
        entidadId: usuario.id,
        detalle: { campos: ['rol', 'token_version'] },
      },
      { transaction },
    );
    return serializarUsuario(usuario);
  });
}

module.exports = {
  listarCorreos,
  autorizarCorreo,
  revocarCorreo,
  listarUsuarios,
  cambiarRol,
};
