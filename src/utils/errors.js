class AppError extends Error {
  /**
   * @param {string} message Mensaje apto para mostrar al usuario.
   * @param {number} statusCode Código HTTP.
   * @param {*} details Información técnica (solo se expone en desarrollo).
   * @param {Object<string,string>} fieldErrors Errores por campo { campo: mensaje }.
   * @param {Object} meta Propiedades extra que se incluyen en la respuesta.
   */
  constructor(message, statusCode = 400, details = null, fieldErrors = null, meta = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.fieldErrors = fieldErrors;
    this.meta = meta;
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor.';

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'El cuerpo de la petición no es un JSON válido.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'La petición excede el tamaño permitido.';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos.';
  }

  if (statusCode >= 500) {
    // Nunca se registra el cuerpo de la petición: puede contener datos personales.
    console.error(`[error] ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);

    if (process.env.NODE_ENV === 'production') {
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
