const { AppError } = require('../utils/errors');

/** Convierte los issues de zod en { campo: mensaje } (primer mensaje por campo). */
function erroresPorCampo(issues) {
  const errores = {};

  issues.forEach((issue) => {
    const campo = issue.path.length ? issue.path.join('.') : '_';
    if (!errores[campo]) {
      errores[campo] = issue.message;
    }
  });

  return errores;
}

/**
 * Valida partes de la petición con esquemas zod. El resultado ya normalizado
 * queda en req.validated.{body,query,params}; los controladores solo leen de ahí.
 */
function validate(schemas) {
  return (req, res, next) => {
    req.validated = req.validated || {};

    for (const parte of ['params', 'query', 'body']) {
      if (!schemas[parte]) continue;

      const resultado = schemas[parte].safeParse(req[parte] === undefined ? {} : req[parte]);

      if (!resultado.success) {
        const errores = erroresPorCampo(resultado.error.issues);
        const primerMensaje = resultado.error.issues[0].message;
        return next(new AppError(primerMensaje, 400, null, errores));
      }

      req.validated[parte] = resultado.data;
    }

    return next();
  };
}

module.exports = { validate, erroresPorCampo };
