const request = require('supertest');
const app = require('../src/app');
const reloj = require('../src/lib/reloj');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const {
  crearPaciente,
  crearTerapeutaConHorario,
  crearSala,
  insertarCita,
  enMerida,
} = require('./fixtures');

describe('Agenda y resumen del dashboard', () => {
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

  test('la vista diaria filtra citas y respeta el modo privado', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19' });

    const response = await request(app)
      .get(
        `/api/agenda?vista=dia&fecha=2026-10-19&terapeuta_id=${terapeuta.id}&sala_id=${sala.id}&privado=1`,
      )
      .set(bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.data.citas).toHaveLength(1);
    expect(response.body.data.citas[0].paciente.nombre_completo).toBe('Paciente reservado');
  });

  test('la vista mensual agrupa por fecha y entrega todos los días del mes', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19' });
    const secondPatient = await crearPaciente();
    await insertarCita({
      paciente: secondPatient,
      terapeuta,
      sala,
      fecha: '2026-10-19',
      hora_inicio: '11:00',
    });
    await insertarCita({ paciente: secondPatient, terapeuta, sala, fecha: '2026-10-20' });

    const response = await request(app)
      .get(
        `/api/agenda?vista=mes&fecha=2026-10-07&terapeuta_id=${terapeuta.id}&sala_id=${sala.id}&privado=0`,
      )
      .set(bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.data.dias).toHaveLength(31);
    expect(response.body.data.dias.find((day) => day.fecha === '2026-10-19').total).toBe(2);
    expect(response.body.data.dias.find((day) => day.fecha === '2026-10-20').total).toBe(1);
  });

  test('valida la vista y requiere autenticación', async () => {
    const unauthorized = await request(app).get('/api/agenda?vista=mes&fecha=2026-10-07');
    expect(unauthorized.status).toBe(401);
    const invalid = await request(app)
      .get('/api/agenda?vista=trimestre&fecha=2026-10-07')
      .set(bearer(token));
    expect(invalid.status).toBe(400);
  });

  test('el resumen agrega KPIs, ocupación diaria y próximas citas', async () => {
    await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-16' });

    const response = await request(app).get('/api/dashboard/resumen').set(bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      fecha: '2026-10-16',
      citas_hoy: 1,
      pendientes_semana: 1,
      pacientes_activos: 1,
      terapeutas_activos: 1,
    });
    expect(response.body.data.ocupacion_salas[0]).toMatchObject({
      nombre: 'Sala A',
      bloques_ocupados: 2,
      bloques_totales: 24,
      porcentaje: 8,
    });
    expect(response.body.data.proximas_citas).toHaveLength(1);
  });
});
