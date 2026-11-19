const { ConnectionError, TimeoutError } = require('sequelize');

class AppError extends Error {
  /**
   * @param {string} message Mensaje apto para mostrar al usuario.
   * @param {number} statusCode Código HTTP.
   * @param {*} details Información técnica (solo se expone en desarrollo).
   * @param {Object<string,string>} fieldErrors Errores por campo { campo: mensaje }.
   * @param {Object} meta Propiedades extra que se incluyen en la respuesta.
   * @param {boolean} expose Si el mensaje es seguro para mostrar en producción.
   */
  constructor(
    message,
    statusCode = 400,
    details = null,
    fieldErrors = null,
    meta = null,
    expose = false,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.fieldErrors = fieldErrors;
    this.meta = meta;
    this.expose = expose;
  }
}

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor.';
  let esErrorDeConexion = false;

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'El cuerpo de la petición no es un JSON válido.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'La petición excede el tamaño permitido.';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos.';
  } else if (err instanceof ConnectionError || err instanceof TimeoutError) {
    // El cliente conserva lo que escribió: nada se guardó y puede reintentar.
    statusCode = 503;
    message = 'No se pudo guardar por un problema de conexión con el servidor. Inténtalo de nuevo.';
    esErrorDeConexion = true;
  }

  if (statusCode >= 500) {
    // Nunca se registra el cuerpo de la petición: puede contener datos personales.
    console.error(`[error] ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);

    // Los errores 503 de conexión y los marcados como `expose` llevan mensaje
    // accionable para el usuario; el resto se genériciza en producción.
    if (process.env.NODE_ENV === 'production' && !esErrorDeConexion && !err.expose) {
      message = 'Error interno del servidor.';
    }
  }

  const response = {
    success: false,
    message,
  };

  if (err.fieldErrors) {
    response.errors = err.fieldErrors;
  }

  if (err.meta) {
    Object.assign(response, err.meta);
  }

  if (process.env.NODE_ENV === 'development' && err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  AppError,
  errorHandler,
};
