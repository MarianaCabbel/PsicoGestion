const { Op } = require('sequelize');
const { Cita } = require('../../config/database');
const { REQUIERE_HORARIO_TERAPEUTA } = require('../../config/clinica');
const { registrarBajaGuard } = require('../../lib/bajaGuards');
const { registrarCambioHorarioGuard } = require('../../lib/cambioHorarioGuards');
const { horaAMinutos } = require('../../lib/fechas');
const { enClinica, ahora } = require('../../lib/reloj');
const { diaSemanaISO, fusionarFranjas } = require('../../lib/slots');
const { condicionNoVencida } = require('./citas.estado');

const MAX_FOLIOS_EN_MENSAJE = 5;

function describirFolios(folios) {
  const visibles = folios.slice(0, MAX_FOLIOS_EN_MENSAJE).join(', ');
  const resto = folios.length - MAX_FOLIOS_EN_MENSAJE;

  return resto > 0 ? `${visibles} y ${resto} más` : visibles;
}

async function foliosPendientesFuturos(campo, id, transaction) {
  const citas = await Cita.findAll({
    attributes: ['folio'],
    where: { [campo]: id, estado: 'pendiente', ...condicionNoVencida(enClinica(ahora())) },
    order: [['fecha', 'ASC'], ['hora_inicio', 'ASC']],
    transaction,
    raw: true,
  });

  return citas.map((cita) => cita.folio);
}

function reglaDeBaja(campo, sujeto) {
  return async (id, { transaction } = {}) => {
    const folios = await foliosPendientesFuturos(campo, id, transaction);

    if (folios.length === 0) return null;

    return `${sujeto} tiene ${folios.length} cita(s) pendiente(s) futura(s) (${describirFolios(folios)}). Cancélalas o reprográmalas antes de darlo de baja.`;
  };
}

/** Citas pendientes que quedarían fuera del nuevo horario semanal del terapeuta. */
async function citasFueraDelNuevoHorario(terapeutaId, franjas, { transaction } = {}) {
  if (!REQUIERE_HORARIO_TERAPEUTA) return [];

  const citas = await Cita.findAll({
    attributes: ['folio', 'fecha', 'hora_inicio', 'hora_fin'],
    where: { terapeuta_id: terapeutaId, estado: 'pendiente', ...condicionNoVencida(enClinica(ahora())) },
    transaction,
    raw: true,
  });

  const porDia = new Map();
  franjas.forEach((franja) => {
    const lista = porDia.get(Number(franja.dia_semana)) || [];
    lista.push({ inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) });
    porDia.set(Number(franja.dia_semana), lista);
  });
  porDia.forEach((lista, dia) => porDia.set(dia, fusionarFranjas(lista)));

  return citas
    .filter((cita) => {
      const inicio = horaAMinutos(cita.hora_inicio);
      const fin = horaAMinutos(cita.hora_fin);
      const cubiertas = porDia.get(diaSemanaISO(cita.fecha)) || [];

      return !cubiertas.some((franja) => franja.inicio <= inicio && franja.fin >= fin);
    })
    .map((cita) => cita.folio);
}

let registrado = false;

/** Conecta las reglas de citas con los módulos de pacientes, terapeutas y salas. */
function registrarGuardsDeCitas({ forzar = false } = {}) {
  if (registrado && !forzar) return;

  registrarBajaGuard('paciente', reglaDeBaja('paciente_id', 'El paciente'));
  registrarBajaGuard('terapeuta', reglaDeBaja('terapeuta_id', 'El terapeuta'));
  registrarBajaGuard('sala', reglaDeBaja('sala_id', 'La sala'));
  registrarCambioHorarioGuard(citasFueraDelNuevoHorario);

  registrado = true;
}

module.exports = { registrarGuardsDeCitas, citasFueraDelNuevoHorario, foliosPendientesFuturos };
