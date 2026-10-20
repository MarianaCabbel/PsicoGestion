/**
 * Validación de la CURP (Clave Única de Registro de Población).
 * Incluye estructura, fecha embebida, sexo y dígito verificador.
 */
const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

function normalizarCurp(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase();
}

/** Dígito verificador a partir de los primeros 17 caracteres. */
function digitoVerificador(curp17) {
  const base = normalizarCurp(curp17).slice(0, 17);
  let suma = 0;

  for (let i = 0; i < 17; i += 1) {
    const valor = ALFABETO.indexOf(base[i]);
    if (valor === -1) return null;
    suma += valor * (18 - i);
  }

  return (10 - (suma % 10)) % 10;
}

function esFechaReal(anio, mes, dia) {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/**
 * Extrae fecha de nacimiento (YYYY-MM-DD) y sexo de una CURP con estructura válida.
 * El carácter 17 distingue el siglo: dígito = 1900-1999, letra = 2000 en adelante.
 */
function extraerDatosCurp(curp) {
  const valor = normalizarCurp(curp);
  const yy = Number(valor.slice(4, 6));
  const mm = Number(valor.slice(6, 8));
  const dd = Number(valor.slice(8, 10));
  const siglo = /\d/.test(valor[16]) ? 1900 : 2000;
  const anio = siglo + yy;

  if (!esFechaReal(anio, mm, dd)) return null;

  return {
    fecha_nacimiento: `${anio}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    sexo: valor[10],
  };
}

/** Devuelve { valido, error } con un mensaje apto para mostrar al usuario. */
function validarCurp(curp) {
  const valor = normalizarCurp(curp);

  if (valor.length !== 18) {
    return { valido: false, error: 'La CURP debe tener 18 caracteres.' };
  }

  if (!CURP_REGEX.test(valor)) {
    return { valido: false, error: 'La CURP no tiene un formato válido.' };
  }

  if (!extraerDatosCurp(valor)) {
    return { valido: false, error: 'La fecha incluida en la CURP no es válida.' };
  }

  if (digitoVerificador(valor) !== Number(valor[17])) {
    return { valido: false, error: 'El dígito verificador de la CURP no es correcto.' };
  }

  return { valido: true, error: null };
}

/**
 * Verifica que la fecha de nacimiento y el sexo capturados coincidan con los
 * que codifica la CURP. Devuelve un objeto { campo: mensaje } (vacío si todo coincide).
 */
function inconsistenciasCurp({ curp, fecha_nacimiento, sexo }) {
  const datos = extraerDatosCurp(curp);
  const errores = {};

  if (!datos) return errores;

  if (fecha_nacimiento && datos.fecha_nacimiento !== fecha_nacimiento) {
    errores.fecha_nacimiento = 'La fecha de nacimiento no coincide con la CURP.';
  }

  if (sexo && datos.sexo !== sexo) {
    errores.sexo = 'El sexo no coincide con la CURP.';
  }

  return errores;
}

module.exports = {
  CURP_REGEX,
  normalizarCurp,
  digitoVerificador,
  extraerDatosCurp,
  validarCurp,
  inconsistenciasCurp,
};
