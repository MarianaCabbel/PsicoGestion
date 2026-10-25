const { Op, fn, col } = require('sequelize');
const { Cita, CitaOcupacion, Paciente, Terapeuta, Sala } = require('../../config/database');
const { enClinica, ahora } = require('../../lib/reloj');
const { rangoDeFecha } = require('../../lib/rangos');
const { NUM_SLOTS } = require('../../lib/slots');
const { filtroPorEstado } = require('../citas/citas.estado');

const INCLUDES = [
  { association: 'paciente', paranoid: false, attributes: ['id', 'nombre_completo'] },
  { association: 'terapeuta', paranoid: false, attributes: ['id', 'nombre_completo'] },
  { association: 'sala', paranoid: false, attributes: ['id', 'nombre'] },
];

async function resumen() {
  const ahoraClinica = enClinica(ahora());
  const { desde, hasta } = rangoDeFecha('semana', ahoraClinica.fecha);
  const hoy = ahoraClinica.fecha;

  const [citasHoy, pendientesSemana, pacientesActivos, terapeutasActivos, salas, citasProximas] =
    await Promise.all([
      Cita.count({ where: { fecha: hoy, estado: 'pendiente' } }),
      Cita.count({
        where: {
          [Op.and]: [
            filtroPorEstado('pendiente', ahoraClinica),
            { fecha: { [Op.between]: [desde, hasta] } },
          ],
        },
      }),
      Paciente.count(),
      Terapeuta.count(),
      Sala.findAll({
        attributes: ['id', 'nombre'],
        order: [
          ['nombre_norm', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
      Cita.findAll({
        where: {
          [Op.and]: [filtroPorEstado('pendiente', ahoraClinica), { fecha: { [Op.gte]: hoy } }],
        },
        include: INCLUDES,
        order: [
          ['fecha', 'ASC'],
          ['hora_inicio', 'ASC'],
        ],
        limit: 5,
      }),
    ]);

  const usoSalaHoy = salas.length
    ? await CitaOcupacion.findAll({
        attributes: ['sala_id', [fn('COUNT', col('id')), 'ocupados']],
        where: { fecha: hoy, sala_id: { [Op.in]: salas.map((sala) => sala.id) } },
        group: ['sala_id'],
        raw: true,
      })
    : [];
  const usos = new Map(usoSalaHoy.map((row) => [Number(row.sala_id), Number(row.ocupados)]));

  return {
    fecha: hoy,
    citas_hoy: citasHoy,
    pendientes_semana: pendientesSemana,
    pacientes_activos: pacientesActivos,
    terapeutas_activos: terapeutasActivos,
    ocupacion_salas: salas.map((sala) => {
      const ocupados = usos.get(sala.id) ?? 0;
      return {
        id: sala.id,
        nombre: sala.nombre,
        bloques_ocupados: ocupados,
        bloques_totales: NUM_SLOTS,
        porcentaje: Math.round((ocupados / NUM_SLOTS) * 100),
      };
    }),
    proximas_citas: citasProximas.map((cita) => ({
      id: cita.id,
      folio: cita.folio,
      fecha: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: cita.hora_fin,
      paciente: cita.paciente?.nombre_completo ?? 'Paciente',
      terapeuta: cita.terapeuta?.nombre_completo ?? 'Terapeuta',
      sala: cita.sala?.nombre ?? 'Sala',
    })),
  };
}

module.exports = { resumen };
