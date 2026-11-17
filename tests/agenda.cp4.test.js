const request = require('supertest');
const app = require('../src/app');
const reloj = require('../src/lib/reloj');
const { CitaOcupacion } = require('../src/config/database');
const { NUM_SLOTS } = require('../src/lib/slots');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const {
  crearPaciente,
  crearTerapeutaConHorario,
  crearSala,
  insertarCita,
  insertarCitas,
  enMerida,
} = require('./fixtures');

// Varias pruebas insertan 24 citas; en equipos lentos el valor por omisión de
// Jest (10 s) puede alcanzar solo para preparar los datos.
jest.setTimeout(30000);

/** Agenda de una vista concreta. */
function consultar(token, query) {
  return request(app)
    .get('/api/agenda')
    .query(query)
    .set(bearer(token));
}

describe('CP4-INT agenda: consulta, estados y privacidad', () => {
  useTestDatabase();

  let token;
  let paciente;
  let terapeuta;
  let sala;

  beforeEach(async () => {
    reloj.fijarAhora(enMerida('2026-10-16', '08:00'));
    token = await loginAs(app);
    paciente = await crearPaciente();
    terapeuta = await crearTerapeutaConHorario();
    sala = await crearSala('Sala A');
  });

  test('CP4-INT-01/03 la vista diaria devuelve las citas programadas de esa fecha', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '10:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-17', hora_inicio: '10:00' });

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16', privado: '0' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      vista: 'dia',
      fecha: '2026-10-16',
      desde: '2026-10-16',
      hasta: '2026-10-16',
    });
    expect(response.body.data.citas).toHaveLength(1);
    expect(response.body.data.citas[0]).toMatchObject({
      fecha: '2026-10-16',
      hora_inicio: '10:00',
      hora_fin: '11:00',
      estado: 'pendiente',
    });
    expect(response.body.data.citas[0].paciente.nombre_completo).toBe(paciente.nombre_completo);
  });

  test('CP4-INT-02 la agenda vacía responde con una lista vacía', async () => {
    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-19' });

    expect(response.status).toBe(200);
    expect(response.body.data.citas).toEqual([]);
  });

  test('CP4-INT-04 la vista semanal abarca de lunes a domingo', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-12', hora_inicio: '07:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-18', hora_inicio: '18:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19', hora_inicio: '09:00' });

    const response = await consultar(token, { vista: 'semana', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      desde: '2026-10-12',
      hasta: '2026-10-18',
    });
    expect(response.body.data.citas.map((cita) => cita.fecha)).toEqual([
      '2026-10-12',
      '2026-10-18',
    ]);
  });

  test('CP4-INT-05/09 la vista mensual incluye todos los días y su total', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '09:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '11:00' });
    const otroPaciente = await crearPaciente();
    await insertarCita({
      paciente: otroPaciente,
      terapeuta,
      sala,
      fecha: '2026-10-20',
      hora_inicio: '09:00',
    });

    const response = await consultar(token, { vista: 'mes', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data.dias).toHaveLength(31);
    expect(response.body.data.dias.find((dia) => dia.fecha === '2026-10-16')).toMatchObject({
      total: 2,
      dia_atencion: true,
    });
    expect(response.body.data.dias.find((dia) => dia.fecha === '2026-10-20').total).toBe(1);
    expect(response.body.data.dias.find((dia) => dia.fecha === '2026-10-17').total).toBe(0);
  });

  test('CP4-INT-06 una vista con 24 citas responde en menos de 2 segundos', async () => {
    await insertarCitas(
      Array.from({ length: NUM_SLOTS }, (_, indice) => {
        const minutos = 7 * 60 + indice * 30;
        const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        return {
          paciente,
          terapeuta,
          sala,
          fecha: '2026-10-16',
          hora_inicio: hora,
          duracion_slots: 1,
        };
      }),
    );

    const started = Date.now();
    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data.citas).toHaveLength(NUM_SLOTS);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test('CP4-INT-07/08 conserva las citas simultáneas de salas y terapeutas distintas', async () => {
    const otraSala = await crearSala('Sala B');
    const otroTerapeuta = await crearTerapeutaConHorario();
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '09:00' });
    await insertarCita({
      paciente: await crearPaciente(),
      terapeuta: otroTerapeuta,
      sala: otraSala,
      fecha: '2026-10-16',
      hora_inicio: '09:00',
    });

    const dia = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });
    const semana = await consultar(token, { vista: 'semana', fecha: '2026-10-16' });

    for (const response of [dia, semana]) {
      expect(response.status).toBe(200);
      expect(response.body.data.citas).toHaveLength(2);
      const [primera, segunda] = response.body.data.citas;
      expect(primera.hora_inicio).toBe('09:00');
      expect(segunda.hora_inicio).toBe('09:00');
      expect(primera.id).not.toBe(segunda.id);
      expect(primera.sala.nombre).not.toBe(segunda.sala.nombre);
      expect(primera.terapeuta.nombre_completo).not.toBe(segunda.terapeuta.nombre_completo);
    }
  });

  test('CP4-INT-10 muestra las 24 citas de un día completo', async () => {
    const citas = await insertarCitas(
      Array.from({ length: NUM_SLOTS }, (_, indice) => {
        const minutos = 7 * 60 + indice * 30;
        const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        return {
          paciente,
          terapeuta,
          sala,
          fecha: '2026-10-16',
          hora_inicio: hora,
          duracion_slots: 1,
        };
      }),
    );

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data.citas.map((cita) => cita.folio).sort()).toEqual(
      citas.map((cita) => cita.folio).sort(),
    );
  });

  test('CP4-INT-14 calcula "vencida" para una cita pendiente cuyo término ya pasó', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-15', hora_inicio: '09:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '10:00' });

    const response = await consultar(token, { vista: 'semana', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data.citas.map((cita) => cita.estado)).toEqual(['vencida', 'pendiente']);
  });

  test('CP4-INT-15 consulta la fecha solicitada y no otras', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-20', hora_inicio: '09:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-21', hora_inicio: '09:00' });

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-20' });

    expect(response.status).toBe(200);
    expect(response.body.data.fecha).toBe('2026-10-20');
    expect(response.body.data.citas).toHaveLength(1);
    expect(response.body.data.citas[0].fecha).toBe('2026-10-20');
  });

  test('CP4-INT-16 rechaza fechas imposibles o con formato incorrecto', async () => {
    const imposible = await consultar(token, { vista: 'dia', fecha: '2026-02-31' });
    const formato = await consultar(token, { vista: 'dia', fecha: '31/02/2026' });

    expect(imposible.status).toBe(400);
    expect(imposible.body.message).toMatch(/no es una fecha válida/);
    expect(formato.status).toBe(400);
  });

  test('CP4-INT-18/20 registra un bloque por cada 30 minutos de la cita', async () => {
    const cita = await insertarCita({
      paciente,
      terapeuta,
      sala,
      fecha: '2026-10-16',
      hora_inicio: '10:00',
      duracion_slots: 4,
    });

    const bloques = await CitaOcupacion.findAll({ where: { cita_id: cita.id }, order: [['slot', 'ASC']] });
    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });

    expect(bloques.map((bloque) => bloque.slot)).toEqual([6, 7, 8, 9]);
    expect(response.body.data.citas[0]).toMatchObject({
      hora_inicio: '10:00',
      hora_fin: '12:00',
      duracion_slots: 4,
    });
  });

  test('CP4-INT-19 incluye una cita en el último bloque de 18:30 a 19:00', async () => {
    await insertarCita({
      paciente,
      terapeuta,
      sala,
      fecha: '2026-10-16',
      hora_inicio: '18:30',
      duracion_slots: 1,
    });

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });

    expect(response.status).toBe(200);
    expect(response.body.data.citas).toHaveLength(1);
    expect(response.body.data.citas[0]).toMatchObject({
      hora_inicio: '18:30',
      hora_fin: '19:00',
      duracion_slots: 1,
    });
  });

  test('CP4-INT-21 ordena por fecha y hora de inicio', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '11:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '09:00' });
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-15', hora_inicio: '10:00' });

    const response = await consultar(token, { vista: 'semana', fecha: '2026-10-16' });

    expect(response.body.data.citas.map((cita) => `${cita.fecha} ${cita.hora_inicio}`)).toEqual([
      '2026-10-15 10:00',
      '2026-10-16 09:00',
      '2026-10-16 11:00',
    ]);
  });

  test('CP4-INT-26 el modo privado oculta el nombre del paciente', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '09:00' });

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16', privado: '1' });

    expect(response.status).toBe(200);
    expect(response.body.data.privado).toBe(true);
    expect(response.body.data.citas[0].paciente.nombre_completo).toBe('Paciente reservado');
    expect(response.body.data.citas[0].terapeuta.nombre_completo).toBe(terapeuta.nombre_completo);
    expect(response.body.data.citas[0].sala.nombre).toBe(sala.nombre);
  });

  test('una cita cancelada no aparece en la agenda ni ocupa bloques', async () => {
    const cancelada = await insertarCita({
      paciente,
      terapeuta,
      sala,
      fecha: '2026-10-16',
      hora_inicio: '09:00',
      estado: 'cancelada',
    });

    const response = await consultar(token, { vista: 'dia', fecha: '2026-10-16' });
    const bloques = await CitaOcupacion.count({ where: { cita_id: cancelada.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.citas).toEqual([]);
    expect(bloques).toBe(0);
  });

  test('filtra por terapeuta y por sala', async () => {
    const otraSala = await crearSala('Sala B');
    const otroTerapeuta = await crearTerapeutaConHorario();
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16', hora_inicio: '09:00' });
    await insertarCita({
      paciente: await crearPaciente(),
      terapeuta: otroTerapeuta,
      sala: otraSala,
      fecha: '2026-10-16',
      hora_inicio: '10:00',
    });

    const porTerapeuta = await consultar(token, {
      vista: 'dia',
      fecha: '2026-10-16',
      terapeuta_id: terapeuta.id,
    });
    const porSala = await consultar(token, {
      vista: 'dia',
      fecha: '2026-10-16',
      sala_id: otraSala.id,
    });

    expect(porTerapeuta.body.data.citas).toHaveLength(1);
    expect(porTerapeuta.body.data.citas[0].terapeuta.id).toBe(terapeuta.id);
    expect(porSala.body.data.citas).toHaveLength(1);
    expect(porSala.body.data.citas[0].sala.id).toBe(otraSala.id);
  });

  test('requiere sesión y valida la vista solicitada', async () => {
    const sinSesion = await request(app).get('/api/agenda').query({ vista: 'dia', fecha: '2026-10-16' });
    const vistaInvalida = await consultar(token, { vista: 'trimestre', fecha: '2026-10-16' });

    expect(sinSesion.status).toBe(401);
    expect(vistaInvalida.status).toBe(400);
  });
});
