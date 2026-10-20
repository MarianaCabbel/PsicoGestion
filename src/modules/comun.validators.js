const { z } = require('zod');
const { PAGINA_LIMITE_MAXIMO, PAGINA_LIMITE_DEFECTO } = require('../config/clinica');
const { esFechaValida, hoyEnClinica, edadEnAnios } = require('../lib/fechas');

/** Campo de texto obligatorio: ausente, nulo o vacío producen el mismo mensaje. */
function textoRequerido(mensaje, extra = (esquema) => esquema) {
  return z.preprocess(
    (valor) => (valor === undefined || valor === null ? '' : valor),
    extra(z.string({ error: mensaje }).trim().min(1, mensaje))
  );
}

/** Nombre de persona: letras (con acentos), espacios, apóstrofo, punto y guion. */
function nombrePersona(etiqueta = 'El nombre completo') {
  return textoRequerido(`${etiqueta} es obligatorio.`, (base) =>
    base
      .min(2, `${etiqueta} debe tener al menos 2 caracteres.`)
      .max(100, `${etiqueta} no puede exceder 100 caracteres.`)
      .regex(/^[\p{L}\p{M}' .-]+$/u, `${etiqueta} solo puede contener letras, espacios, apóstrofo, punto y guion.`)
      .regex(/\p{L}/u, `${etiqueta} debe contener letras.`)
      .transform((valor) => valor.replace(/\s+/g, ' '))
  );
}

/** Teléfono de 10 dígitos; se aceptan separadores que se descartan al normalizar. */
function telefonoDiezDigitos(etiqueta = 'El teléfono') {
  return z.preprocess(
    (valor) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor).replace(/\D/g, '') : ''),
    z
      .string()
      .min(1, `${etiqueta} es obligatorio.`)
      .regex(/^\d{10}$/, `${etiqueta} debe tener 10 dígitos.`)
  );
}

function fechaCalendario(etiqueta) {
  return textoRequerido(`${etiqueta} es obligatoria.`, (base) =>
    base.refine((valor) => esFechaValida(valor), `${etiqueta} no es una fecha válida (AAAA-MM-DD).`)
  );
}

/** Verifica que no sea futura y que la edad esté dentro de [min, max]. */
function agregarReglasDeEdad(ctx, fecha, { minima, maxima, mensajeMinima }) {
  if (!esFechaValida(fecha)) return;

  const hoy = hoyEnClinica();

  if (fecha > hoy) {
    ctx.addIssue({ code: 'custom', path: ['fecha_nacimiento'], message: 'La fecha de nacimiento no puede ser futura.' });
    return;
  }

  const edad = edadEnAnios(fecha, hoy);

  if (edad < minima) {
    ctx.addIssue({ code: 'custom', path: ['fecha_nacimiento'], message: mensajeMinima });
  } else if (edad > maxima) {
    ctx.addIssue({ code: 'custom', path: ['fecha_nacimiento'], message: 'La fecha de nacimiento no es válida.' });
  }
}

function correoNormalizado(mensajeObligatorio) {
  return textoRequerido(mensajeObligatorio, (base) =>
    base
      .max(150, 'El correo no puede exceder 150 caracteres.')
      .transform((valor) => valor.toLowerCase())
      .pipe(z.email({ error: 'El correo electrónico no es válido.' }))
  );
}

function correoOpcional() {
  return z.preprocess(
    (valor) => (valor === undefined || valor === null || String(valor).trim() === '' ? null : valor),
    z
      .string()
      .trim()
      .max(150, 'El correo no puede exceder 150 caracteres.')
      .transform((valor) => valor.toLowerCase())
      .pipe(z.email({ error: 'El correo electrónico no es válido.' }))
      .nullable()
  );
}

const idParams = z.object({
  id: z.coerce
    .number({ error: 'El identificador no es válido.' })
    .int('El identificador no es válido.')
    .positive('El identificador no es válido.'),
});

const confirmacionBody = z.object({
  confirmar: z.literal(true, { error: 'Debes confirmar la acción explícitamente.' }),
});

/** Identificador de una entidad relacionada, con mensaje propio por campo. */
function idRelacionado(mensajeObligatorio) {
  return z.preprocess(
    (valor) => (valor === '' || valor === null ? undefined : valor),
    z.coerce
      .number({ error: mensajeObligatorio })
      .int(mensajeObligatorio)
      .positive(mensajeObligatorio)
  );
}

/** El primer estado de la lista es el valor por defecto del filtro. */
function consultaListado(estadosPermitidos = ['activo', 'baja', 'todos']) {
  return z.object({
    q: z
      .string()
      .trim()
      .max(100, 'La búsqueda no puede exceder 100 caracteres.')
      .optional()
      .default(''),
    estado: z
      .enum(estadosPermitidos, { error: 'El estado solicitado no es válido.' })
      .optional()
      .default(estadosPermitidos[0]),
    page: z.coerce.number().int().min(1, 'La página debe ser mayor o igual a 1.').optional().default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'El límite debe ser mayor o igual a 1.')
      .max(PAGINA_LIMITE_MAXIMO, `El límite máximo es ${PAGINA_LIMITE_MAXIMO}.`)
      .optional()
      .default(PAGINA_LIMITE_DEFECTO),
  });
}

module.exports = {
  textoRequerido,
  nombrePersona,
  telefonoDiezDigitos,
  fechaCalendario,
  agregarReglasDeEdad,
  correoNormalizado,
  correoOpcional,
  idParams,
  idRelacionado,
  confirmacionBody,
  consultaListado,
};
