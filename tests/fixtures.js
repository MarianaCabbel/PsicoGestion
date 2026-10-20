const sharp = require('sharp');
const { digitoVerificador } = require('../src/lib/curp');
const { hoyEnClinica } = require('../src/lib/fechas');

const CONSONANTES = 'BCDFGHJKLMNPQRSTVWXYZ';
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Genera una CURP estructuralmente correcta con dígito verificador válido. */
function crearCurp({ fecha = '1990-04-27', sexo = 'H', estado = 'YN', semilla = 0 } = {}) {
  const [anio, mes, dia] = fecha.split('-');
  const inicial = LETRAS[semilla % 26];
  const segunda = LETRAS[Math.floor(semilla / 26) % 26];
  const consonantes = [0, 1, 2].map((i) => CONSONANTES[(semilla + i * 7) % CONSONANTES.length]).join('');
  const diferenciador = Number(anio) >= 2000 ? 'A' : '0';

  const base = `${inicial}E${segunda}G${anio.slice(2)}${mes}${dia}${sexo}${estado}${consonantes}${diferenciador}`;
  return `${base}${digitoVerificador(base)}`;
}

function datosPaciente(overrides = {}) {
  const fecha = overrides.fecha_nacimiento || '1990-04-27';
  const sexo = overrides.sexo || 'H';

  return {
    nombre_completo: 'María José Hernández Pérez',
    curp: crearCurp({ fecha, sexo, semilla: overrides.semilla || 0 }),
    sexo,
    fecha_nacimiento: fecha,
    telefono: '9991234567',
    ...overrides,
    ...(overrides.semilla !== undefined ? { semilla: undefined } : {}),
  };
}

function datosTerapeuta(overrides = {}) {
  return {
    nombre_completo: 'Dr. Luis Alberto Canché Mex',
    telefono: '9997654321',
    correo: 'luis.canche@correo.uady.mx',
    fecha_nacimiento: '1985-06-15',
    cedula_profesional: '12345678',
    ...overrides,
  };
}

/** Imagen sintética de pruebas (color sólido) en el formato indicado. */
async function crearImagen({ ancho = 400, alto = 400, formato = 'png' } = {}) {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    [formato]()
    .toBuffer();
}

/**
 * Fecha YYYY-MM-DD de hace `anios` años y `dias` días, calculada sobre la fecha de la
 * clínica (Mérida) y no sobre UTC: así las pruebas de edad no dependen de la hora del día.
 */
function fechaHace(anios, dias = 0) {
  const [anio, mes, dia] = hoyEnClinica().split('-').map(Number);

  return new Date(Date.UTC(anio - anios, mes - 1, dia - dias)).toISOString().slice(0, 10);
}

module.exports = { crearCurp, datosPaciente, datosTerapeuta, crearImagen, fechaHace };

// ---- Fábricas para pruebas de salas y citas (acceso directo a los modelos, sin pasar por la API) ----

const {
  Paciente,
  Terapeuta,
  TerapeutaHorario,
  Sala,
  Cita,
  CitaOcupacion,
} = require('../src/config/database');
const { slotsDeCita, horaFinDe } = require('../src/lib/slots');

let contador = 0;

/** Paciente con CURP única; `correo` por defecto sí tiene (para probar notificaciones). */
async function crearPaciente(overrides = {}) {
  contador += 1;
  const fecha = overrides.fecha_nacimiento || '1990-04-27';
  const sexo = overrides.sexo || 'H';

  return Paciente.create({
    nombre_completo: `Paciente Número ${contador}`,
    curp: crearCurp({ fecha, sexo, semilla: contador }),
    sexo,
    fecha_nacimiento: fecha,
    telefono: '9991234567',
    correo: `paciente${contador}@correo.com`,
    ...overrides,
  });
}

/** Terapeuta con horario semanal; por defecto de lunes a viernes de 07:00 a 19:00. */
async function crearTerapeutaConHorario(overrides = {}, horarios = null) {
  contador += 1;
  const terapeuta = await Terapeuta.create({
    nombre_completo: `Terapeuta Número ${contador}`,
    telefono: '9997654321',
    correo: `terapeuta${contador}@correo.uady.mx`,
    fecha_nacimiento: '1985-06-15',
    cedula_profesional: String(1000000 + contador),
    ...overrides,
  });

  const franjas = horarios || [1, 2, 3, 4, 5].map((dia) => ({ dia_semana: dia, hora_inicio: '07:00', hora_fin: '19:00' }));
  await TerapeutaHorario.bulkCreate(franjas.map((franja) => ({ ...franja, terapeuta_id: terapeuta.id })));

  return terapeuta;
}

async function crearSala(nombre = `Sala ${contador + 1}`) {
  contador += 1;
  return Sala.create({ nombre, nombre_norm: nombre.toLowerCase().replace(/\s+/g, ' ') });
}

/** Cita insertada directamente (con sus ocupaciones), útil para preparar escenarios. */
async function insertarCita({ paciente, terapeuta, sala, fecha, hora_inicio = '09:00', duracion_slots = 2, estado = 'pendiente', folio }) {
  contador += 1;
  const cita = await Cita.create({
    folio: folio || `CIT-2026-9${String(contador).padStart(5, '0')}`,
    paciente_id: paciente.id,
    terapeuta_id: terapeuta.id,
    sala_id: sala.id,
    fecha,
    hora_inicio,
    hora_fin: horaFinDe(hora_inicio, duracion_slots),
    duracion_slots,
    estado,
  });

  if (estado === 'pendiente') {
    await CitaOcupacion.bulkCreate(
      slotsDeCita(hora_inicio, duracion_slots).map((slot) => ({
        cita_id: cita.id,
        fecha,
        slot,
        sala_id: sala.id,
        terapeuta_id: terapeuta.id,
        paciente_id: paciente.id,
      }))
    );
  }

  return cita;
}

/** Instante UTC equivalente a una hora local de Mérida (UTC-6, sin horario de verano). */
function enMerida(fecha, hora = '08:00') {
  const [h, m] = hora.split(':').map(Number);
  const instante = new Date(`${fecha}T00:00:00Z`);
  instante.setUTCHours(h + 6, m);
  return instante;
}

Object.assign(module.exports, {
  crearPaciente,
  crearTerapeutaConHorario,
  crearSala,
  insertarCita,
  enMerida,
});
