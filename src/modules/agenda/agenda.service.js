const { Op, fn, col } = require('sequelize');
const { Cita } = require('../../config/database');
const { rangoDeFecha } = require('../../lib/rangos');
const { enClinica, ahora } = require('../../lib/reloj');
const { estadoEfectivo } = require('../citas/citas.estado');
const { DIAS_ATENCION } = require('../../config/clinica');

const INCLUDES = [
  { association: 'paciente', paranoid: false, attributes: ['id', 'nombre_completo'] },
  { association: 'terapeuta', paranoid: false, attributes: ['id', 'nombre_completo'] },
  { association: 'sala', paranoid: false, attributes: ['id', 'nombre'] },
];

function serializarCita(cita, ahoraClinica, privado) {
  return {
    id: cita.id,
    folio: cita.folio,
    estado: estadoEfectivo(cita, ahoraClinica),
    fecha: cita.fecha,
    hora_inicio: cita.hora_inicio,
    hora_fin: cita.hora_fin,
    duracion_slots: cita.duracion_slots,
    paciente: privado
      ? { id: cita.paciente_id, nombre_completo: 'Paciente reservado' }
      : cita.paciente
        ? { id: cita.paciente.id, nombre_completo: cita.paciente.nombre_completo }
        : { id: cita.paciente_id, nombre_completo: 'Paciente' },
    terapeuta: cita.terapeuta
      ? { id: cita.terapeuta.id, nombre_completo: cita.terapeuta.nombre_completo }
      : { id: cita.terapeuta_id, nombre_completo: 'Terapeuta' },
    sala: cita.sala
      ? { id: cita.sala.id, nombre: cita.sala.nombre }
      : { id: cita.sala_id, nombre: 'Sala' },
  };
}

function whereDeFiltros({ desde, hasta, terapeuta_id, sala_id }) {
  const where = { fecha: { [Op.between]: [desde, hasta] }, estado: 'pendiente' };
  if (terapeuta_id) where.terapeuta_id = terapeuta_id;
  if (sala_id) where.sala_id = sala_id;
  return where;
}

async function consultar({ vista, fecha, terapeuta_id, sala_id, privado }) {
  const { desde, hasta } = rangoDeFecha(vista, fecha);
  const where = whereDeFiltros({ desde, hasta, terapeuta_id, sala_id });

  if (vista === 'mes') {
    const rows = await Cita.findAll({
      attributes: ['fecha', [fn('COUNT', col('id')), 'total']],
      where,
      group: ['fecha'],
      order: [['fecha', 'ASC']],
      raw: true,
    });
    const counts = new Map(rows.map((row) => [String(row.fecha).slice(0, 10), Number(row.total)]));
    const dias = [];
    for (
      let cursor = new Date(`${desde}T00:00:00Z`);
      cursor.toISOString().slice(0, 10) <= hasta;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const dia = cursor.toISOString().slice(0, 10);
      dias.push({
        fecha: dia,
        total: counts.get(dia) ?? 0,
        dia_atencion: DIAS_ATENCION.includes(cursor.getUTCDay() || 7),
      });
    }
    return { vista, fecha, desde, hasta, privado, dias };
  }

  const citas = await Cita.findAll({
    where,
    include: INCLUDES,
    order: [
      ['fecha', 'ASC'],
      ['hora_inicio', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const ahoraClinica = enClinica(ahora());
  return {
    vista,
    fecha,
    desde,
    hasta,
    privado,
    citas: citas.map((cita) => serializarCita(cita, ahoraClinica, privado)),
  };
}

module.exports = { consultar };
