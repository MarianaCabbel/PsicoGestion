require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  CorreoAutorizado,
  Paciente,
  Terapeuta,
  TerapeutaHorario,
  Sala,
  Cita,
  CitaOcupacion,
} = require('../src/config/database');
const { crearMigrator } = require('../src/db/migrator');
const { digitoVerificador } = require('../src/lib/curp');
const { enClinica } = require('../src/lib/reloj');
const { horaFinDe, slotsDeCita } = require('../src/lib/slots');
const { normalizeEmail } = require('../src/utils/authHelpers');

const EMAIL = normalizeEmail(process.env.E2E_SEED_EMAIL || 'e2e@correo.uady.mx');
const PASSWORD = process.env.E2E_SEED_PASSWORD || 'Password123!';
const PHONE = '9990000001';

const CONSONANTES = 'BCDFGHJKLMNPQRSTVWXYZ';
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Secuencia del run para que dos citas simultáneas no compartan folio (máx. 16 caracteres). */
let folioSecuencia = 0;

function siguienteFolio(fecha, horaInicio) {
  folioSecuencia += 1;
  const mesDia = `${fecha.slice(5, 7)}${fecha.slice(8, 10)}`;
  return `E2E-${mesDia}-${horaInicio.replace(':', '')}-${String(folioSecuencia).padStart(2, '0')}`;
}

function crearCurp({ fecha = '1990-04-27', sexo = 'H', semilla = 0 } = {}) {
  const [anio, mes, dia] = fecha.split('-');
  const inicial = LETRAS[semilla % 26];
  const segunda = LETRAS[Math.floor(semilla / 26) % 26];
  const consonantes = [0, 1, 2].map((i) => CONSONANTES[(semilla + i * 7) % CONSONANTES.length]).join('');
  const diferenciador = Number(anio) >= 2000 ? 'A' : '0';
  const base = `${inicial}E${segunda}G${anio.slice(2)}${mes}${dia}${sexo}YN${consonantes}${diferenciador}`;

  return `${base}${digitoVerificador(base)}`;
}

function sumarDias(fecha, dias) {
  const siguiente = new Date(`${fecha}T00:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + dias);
  return siguiente.toISOString().slice(0, 10);
}

function diaDeLaSemana(fecha) {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

/** Lunes de la siguiente semana calendario, siempre a entre 1 y 7 días de distancia. */
function proximoLunes(fecha) {
  const dia = diaDeLaSemana(fecha);
  const distancia = ((8 - dia) % 7) || 7;
  return sumarDias(fecha, distancia);
}

/** Día hábil anterior a `fecha`. */
function anteriorHabil(fecha) {
  let cursor = sumarDias(fecha, -1);
  while (diaDeLaSemana(cursor) === 0 || diaDeLaSemana(cursor) === 6) {
    cursor = sumarDias(cursor, -1);
  }
  return cursor;
}

function horaDeSlot(slot) {
  const minutos = 7 * 60 + slot * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

async function asegurarUsuario() {
  await CorreoAutorizado.findOrCreate({
    where: { correo: EMAIL },
    defaults: { correo: EMAIL, activo: true },
  });

  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await User.findOrCreate({
    where: { correo_institucional: EMAIL },
    defaults: {
      nombre_completo: 'Usuario E2E',
      correo_institucional: EMAIL,
      telefono: PHONE,
      password_hash,
      rol: 'administrador',
      verificado: true,
      token_version: 0,
    },
  });

  await user.update({
    password_hash,
    rol: 'administrador',
    verificado: true,
  });

  return user;
}

async function asegurarPaciente(indice) {
  const curp = crearCurp({ semilla: indice + 10 });
  const [paciente] = await Paciente.findOrCreate({
    where: { curp },
    defaults: {
      nombre_completo: `Paciente E2E ${indice}`,
      curp,
      sexo: 'H',
      fecha_nacimiento: '1990-04-27',
      telefono: String(9991000000 + indice),
      correo: `paciente.e2e${indice}@correo.com`,
    },
  });

  return paciente;
}

async function asegurarTerapeuta(datos) {
  const [terapeuta] = await Terapeuta.findOrCreate({
    where: { correo: datos.correo },
    defaults: datos,
  });

  for (const dia_semana of [1, 2, 3, 4, 5]) {
    await TerapeutaHorario.findOrCreate({
      where: { terapeuta_id: terapeuta.id, dia_semana, hora_inicio: '07:00' },
      defaults: { terapeuta_id: terapeuta.id, dia_semana, hora_inicio: '07:00', hora_fin: '19:00' },
    });
  }

  return terapeuta;
}

async function asegurarSala(nombre) {
  const nombre_norm = nombre.toLowerCase().replace(/\s+/g, ' ');
  const [sala] = await Sala.findOrCreate({
    where: { nombre_norm },
    defaults: { nombre, nombre_norm },
  });

  return sala;
}

async function limpiarCitasE2E() {
  const anteriores = await Cita.findAll({
    where: { folio: { [Op.like]: 'E2E-%' } },
    attributes: ['id'],
  });
  const ids = anteriores.map((cita) => cita.id);

  if (ids.length === 0) return;
  await CitaOcupacion.destroy({ where: { cita_id: { [Op.in]: ids } } });
  await Cita.destroy({ where: { id: { [Op.in]: ids } } });
}

async function asegurarCita({ paciente, terapeuta, sala, fecha, hora_inicio, duracion_slots = 2, estado = 'pendiente' }) {
  const folio = siguienteFolio(fecha, hora_inicio);
  const [cita] = await Cita.findOrCreate({
    where: { folio },
    defaults: {
      folio,
      paciente_id: paciente.id,
      terapeuta_id: terapeuta.id,
      sala_id: sala.id,
      fecha,
      hora_inicio,
      hora_fin: horaFinDe(hora_inicio, duracion_slots),
      duracion_slots,
      estado,
    },
  });

  if (cita.estado === 'pendiente') {
    await CitaOcupacion.destroy({ where: { cita_id: cita.id } });
    await CitaOcupacion.bulkCreate(
      slotsDeCita(hora_inicio, duracion_slots).map((slot) => ({
        cita_id: cita.id,
        fecha,
        slot,
        sala_id: sala.id,
        terapeuta_id: terapeuta.id,
        paciente_id: paciente.id,
      })),
    );
  }

  return cita;
}

async function main() {
  await sequelize.authenticate();
  await crearMigrator(sequelize).up();

  const hoy = enClinica().fecha;
  // Semana siguiente completa: no se mezcla con citas reales de la agenda actual.
  const diaSimultaneas = proximoLunes(hoy);
  const diaMuchas = sumarDias(diaSimultaneas, 1);
  const diaLibre = sumarDias(diaSimultaneas, 2);
  // Día hábil anterior a hoy: garantiza que la cita ya venció.
  const diaVencida = anteriorHabil(hoy);

  await asegurarUsuario();

  const pacientes = [];
  for (let indice = 0; indice < 8; indice += 1) {
    pacientes.push(await asegurarPaciente(indice + 1));
  }

  const terapeutaUno = await asegurarTerapeuta({
    nombre_completo: 'Dra. E2E Uno',
    telefono: '9992000001',
    correo: 'terapeuta.e2e1@correo.uady.mx',
    fecha_nacimiento: '1985-06-15',
    cedula_profesional: '9000001',
  });
  const terapeutaDos = await asegurarTerapeuta({
    nombre_completo: 'Dr. E2E Dos',
    telefono: '9992000002',
    correo: 'terapeuta.e2e2@correo.uady.mx',
    fecha_nacimiento: '1986-07-20',
    cedula_profesional: '9000002',
  });
  const salaUno = await asegurarSala('E2E-A');
  const salaDos = await asegurarSala('E2E-B');

  await limpiarCitasE2E();
  folioSecuencia = 0;

  // Dos citas simultáneas: misma fecha y hora, distinta sala y terapeuta.
  const simultaneaUno = await asegurarCita({
    paciente: pacientes[0],
    terapeuta: terapeutaUno,
    sala: salaUno,
    fecha: diaSimultaneas,
    hora_inicio: '09:00',
    duracion_slots: 2,
  });
  const simultaneaDos = await asegurarCita({
    paciente: pacientes[1],
    terapeuta: terapeutaDos,
    sala: salaDos,
    fecha: diaSimultaneas,
    hora_inicio: '09:00',
    duracion_slots: 2,
  });

  // Cita en el último lapso del día (18:30–19:00).
  const ultimoLapso = await asegurarCita({
    paciente: pacientes[2],
    terapeuta: terapeutaUno,
    sala: salaUno,
    fecha: diaSimultaneas,
    hora_inicio: '18:30',
    duracion_slots: 1,
  });

  // Cita de dos horas: ocupa cuatro lapsos de 30 minutos.
  await asegurarCita({
    paciente: pacientes[3],
    terapeuta: terapeutaDos,
    sala: salaDos,
    fecha: diaSimultaneas,
    hora_inicio: '11:00',
    duracion_slots: 4,
  });

  // Día con 20 citas repartidas en la jornada.
  const citasMuchas = [];
  for (let indice = 0; indice < 20; indice += 1) {
    const hora = horaDeSlot(indice);
    citasMuchas.push(
      await asegurarCita({
        paciente: pacientes[indice % pacientes.length],
        terapeuta: indice % 2 === 0 ? terapeutaUno : terapeutaDos,
        sala: indice % 2 === 0 ? salaUno : salaDos,
        fecha: diaMuchas,
        hora_inicio: hora,
        duracion_slots: 1,
      }),
    );
  }

  // Cita vencida: ayer, pendiente y sin cancelar.
  const citaVencida = await asegurarCita({
    paciente: pacientes[4],
    terapeuta: terapeutaUno,
    sala: salaUno,
    fecha: diaVencida,
    hora_inicio: '10:00',
    duracion_slots: 1,
  });

  const manifest = {
    email: EMAIL,
    password: PASSWORD,
    dates: {
      hoy,
      simultaneas: diaSimultaneas,
      muchas: diaMuchas,
      vencida: diaVencida,
      libre: diaLibre,
    },
    folios: {
      simultanea: [simultaneaUno.folio, simultaneaDos.folio],
      ultimoLapso: ultimoLapso.folio,
      muchas: citasMuchas.map((cita) => cita.folio),
      vencida: citaVencida.folio,
    },
  };
  const destino = path.join(__dirname, '..', 'e2e', 'seed-data.json');
  fs.writeFileSync(destino, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('Datos E2E listos.');
  console.log(`  Usuario: ${EMAIL}`);
  console.log(`  Contraseña: ${PASSWORD}`);
  console.log(`  Simultáneas: ${diaSimultaneas}`);
  console.log(`  Día con 20 citas: ${diaMuchas}`);
  console.log(`  Vencida: ${diaVencida}`);
  console.log(`  Día libre: ${diaLibre}`);
  console.log(`  Manifiesto: ${destino}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
