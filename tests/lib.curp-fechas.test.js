const {
  validarCurp,
  digitoVerificador,
  extraerDatosCurp,
  inconsistenciasCurp,
  normalizarCurp,
} = require('../src/lib/curp');
const { edadEnAnios, esFechaValida, hoyEnClinica, esHoraValida, horaAMinutos } = require('../src/lib/fechas');
const { crearCurp } = require('./fixtures');

describe('CURP', () => {
  test('CP-UNI-30 acepta una CURP con estructura y dígito verificador válidos', () => {
    expect(validarCurp(crearCurp())).toEqual({ valido: true, error: null });
  });

  test('CP-UNI-30 acepta CURP de personas nacidas desde el 2000 (diferenciador alfabético)', () => {
    const curp = crearCurp({ fecha: '2005-11-03', sexo: 'M', estado: 'DF', semilla: 5 });
    expect(validarCurp(curp).valido).toBe(true);
    expect(extraerDatosCurp(curp)).toEqual({ fecha_nacimiento: '2005-11-03', sexo: 'M' });
  });

  test('CP-UNI-31 rechaza longitud distinta de 18 caracteres', () => {
    expect(validarCurp('ABC').error).toBe('La CURP debe tener 18 caracteres.');
    expect(validarCurp(`${crearCurp()}X`).error).toBe('La CURP debe tener 18 caracteres.');
  });

  test('CP-UNI-31 rechaza estructura inválida (entidad federativa inexistente)', () => {
    const curp = crearCurp({ estado: 'YN' }).replace('YN', 'ZZ');
    expect(validarCurp(curp).error).toBe('La CURP no tiene un formato válido.');
  });

  test('CP-UNI-31 rechaza un dígito verificador incorrecto', () => {
    const curp = crearCurp();
    const incorrecto = `${curp.slice(0, 17)}${(Number(curp[17]) + 1) % 10}`;
    expect(validarCurp(incorrecto).error).toBe('El dígito verificador de la CURP no es correcto.');
  });

  test('CP-UNI-31 rechaza una fecha imposible incluida en la CURP (30 de febrero)', () => {
    const base = crearCurp({ fecha: '1990-02-28' }).slice(0, 17).replace('900228', '900230');
    const curp = `${base}${digitoVerificador(base)}`;
    expect(validarCurp(curp).error).toBe('La fecha incluida en la CURP no es válida.');
  });

  test('normaliza espacios y minúsculas', () => {
    expect(normalizarCurp('  abcd  ')).toBe('ABCD');
  });

  test('detecta fecha y sexo que no coinciden con la CURP', () => {
    const curp = crearCurp({ fecha: '1990-04-27', sexo: 'H' });

    expect(inconsistenciasCurp({ curp, fecha_nacimiento: '1990-04-27', sexo: 'H' })).toEqual({});
    expect(inconsistenciasCurp({ curp, fecha_nacimiento: '1991-04-27', sexo: 'M' })).toEqual({
      fecha_nacimiento: 'La fecha de nacimiento no coincide con la CURP.',
      sexo: 'El sexo no coincide con la CURP.',
    });
  });
});

describe('Fechas de la clínica', () => {
  test('CP-UNI-32 calcula la edad cumplida respetando el día del cumpleaños', () => {
    expect(edadEnAnios('2019-10-15', '2026-10-14')).toBe(6);
    expect(edadEnAnios('2019-10-15', '2026-10-15')).toBe(7);
    expect(edadEnAnios('2019-10-16', '2026-10-15')).toBe(6);
  });

  test('valida fechas reales de calendario', () => {
    expect(esFechaValida('2024-02-29')).toBe(true);
    expect(esFechaValida('2025-02-29')).toBe(false);
    expect(esFechaValida('2025-13-01')).toBe(false);
    expect(esFechaValida('01/02/2025')).toBe(false);
  });

  test('hoyEnClinica usa la zona America/Merida (UTC-6)', () => {
    expect(hoyEnClinica(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-15');
    expect(hoyEnClinica(new Date('2026-10-16T06:00:00Z'))).toBe('2026-10-16');
  });

  test('valida y convierte horas HH:mm', () => {
    expect(esHoraValida('07:30')).toBe(true);
    expect(esHoraValida('24:00')).toBe(false);
    expect(esHoraValida('7:30')).toBe(false);
    expect(horaAMinutos('07:30')).toBe(450);
  });
});
