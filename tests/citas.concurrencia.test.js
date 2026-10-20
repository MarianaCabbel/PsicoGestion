const request = require('supertest');
const app = require('../src/app');
const { sequelize, Cita, CitaOcupacion, FolioCounter } = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { registrarGuardsDeCitas } = require('../src/modules/citas/citas.guards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { crearPaciente, crearTerapeutaConHorario, crearSala, enMerida } = require('./fixtures');

const LUNES = '2026-10-19';
const PETICIONES = 20;
let folioSuelto = 0;

describe('Concurrencia y garantías de la base de datos', () => {
  useTestDatabase();

  let token;

  beforeEach(async () => {
    registrarGuardsDeCitas();
    reloj.fijarAhora(enMerida('2026-10-16', '08:00'));
    token = await loginAs(app);
  });

  const agendar = (cuerpo) => request(app).post('/api/citas').set(bearer(token)).send(cuerpo);

  async function crearRecursos(cantidad) {
    const recursos = [];
    for (let i = 0; i < cantidad; i += 1) {
      recursos.push({
        paciente_id: (await crearPaciente()).id,
        terapeuta_id: (await crearTerapeutaConHorario()).id,
        sala_id: (await crearSala(`S${i}-${Date.now() % 100000}`)).id,
      });
    }
    return recursos;
  }

  const base = { fecha: LUNES, hora_inicio: '09:00' };
  const estados = (respuestas) => respuestas.map((r) => r.status).sort();

  test('CP-INT-210 20 altas simultáneas de la misma SALA y hora: exactamente una gana', async () => {
    const recursos = await crearRecursos(PETICIONES);
    const sala_id = recursos[0].sala_id;

    const respuestas = await Promise.all(recursos.map((r) => agendar({ ...base, ...r, sala_id })));

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    const rechazadas = respuestas.filter((r) => r.status === 409);
    expect(rechazadas).toHaveLength(PETICIONES - 1);
    rechazadas.forEach((r) => expect(r.body.errors.sala_id).toBe('La sala ya está ocupada en ese horario.'));

    expect(await Cita.count()).toBe(1);
    expect(await CitaOcupacion.count()).toBe(2);
  });

  test('CP-INT-211 20 altas simultáneas del mismo TERAPEUTA y hora: exactamente una gana', async () => {
    const recursos = await crearRecursos(PETICIONES);
    const terapeuta_id = recursos[0].terapeuta_id;

    const respuestas = await Promise.all(recursos.map((r) => agendar({ ...base, ...r, terapeuta_id })));

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    respuestas.filter((r) => r.status === 409).forEach((r) => {
      expect(r.body.errors.terapeuta_id).toBe('El terapeuta ya tiene una cita en ese horario.');
    });
    expect(await Cita.count()).toBe(1);
  });

  test('CP-INT-212 20 altas simultáneas del mismo PACIENTE y hora: exactamente una gana', async () => {
    const recursos = await crearRecursos(PETICIONES);
    const paciente_id = recursos[0].paciente_id;

    const respuestas = await Promise.all(recursos.map((r) => agendar({ ...base, ...r, paciente_id })));

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await Cita.count()).toBe(1);
  });

  test('CP-INT-213 20 altas simultáneas con recursos distintos: todas se crean con folios únicos y sin huecos', async () => {
    const recursos = await crearRecursos(PETICIONES);

    const respuestas = await Promise.all(recursos.map((r) => agendar({ ...base, ...r })));

    expect(estados(respuestas)).toEqual(Array(PETICIONES).fill(201));

    const folios = respuestas.map((r) => r.body.data.folio).sort();
    const esperados = Array.from({ length: PETICIONES }, (_, i) => `CIT-2026-${String(i + 1).padStart(6, '0')}`);
    expect(folios).toEqual(esperados);
    expect((await FolioCounter.findByPk(2026)).ultimo).toBe(PETICIONES);
    expect(await CitaOcupacion.count()).toBe(PETICIONES * 2);
  });

  test('CP-INT-214 traslapes parciales simultáneos en la misma sala: nunca quedan dos citas solapadas', async () => {
    const recursos = await crearRecursos(8);
    const sala_id = recursos[0].sala_id;
    const horas = ['09:00', '09:30', '10:00', '10:30', '09:00', '09:30', '10:00', '10:30']; // 2 bloques cada una

    const respuestas = await Promise.all(recursos.map((r, i) => agendar({ ...base, ...r, sala_id, hora_inicio: horas[i] })));

    expect(respuestas.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(respuestas.some((r) => r.status === 201)).toBe(true);

    // Invariante: ningún bloque de la sala está ocupado por más de una cita.
    const filas = await CitaOcupacion.findAll({ where: { sala_id }, raw: true });
    const porSlot = new Map();
    filas.forEach((f) => porSlot.set(f.slot, (porSlot.get(f.slot) || 0) + 1));
    expect([...porSlot.values()].every((n) => n === 1)).toBe(true);

    // Y la cantidad de bloques coincide con las citas que sí se crearon (2 por cita).
    expect(filas).toHaveLength((await Cita.count()) * 2);
  });

  test('CP-INT-215 mezcla de altas, cancelaciones y modificaciones simultáneas mantiene la integridad', async () => {
    const recursos = await crearRecursos(6);
    const creadas = await Promise.all(recursos.map((r, i) => agendar({ ...base, ...r, hora_inicio: `${9 + i}:00`.padStart(5, '0') })));
    expect(creadas.every((r) => r.status === 201)).toBe(true);

    const operaciones = [
      ...creadas.slice(0, 3).map((c) => request(app).post(`/api/citas/${c.body.data.id}/cancelar`).set(bearer(token)).send({ confirmar: true })),
      ...creadas.slice(3).map((c) => request(app).put(`/api/citas/${c.body.data.id}`).set(bearer(token)).send({ fecha: '2026-10-20' })),
      agendar({ ...base, ...(await crearRecursos(1))[0] }),
    ];
    const respuestas = await Promise.all(operaciones);

    expect(respuestas.every((r) => [200, 201, 409].includes(r.status))).toBe(true);

    // Solo las citas pendientes ocupan bloques; las canceladas no dejan ninguno.
    const canceladas = await Cita.findAll({ where: { estado: 'cancelada' }, attributes: ['id'], raw: true });
    expect(canceladas).toHaveLength(3);
    expect(await CitaOcupacion.count({ where: { cita_id: canceladas.map((c) => c.id) } })).toBe(0);

    const pendientes = await Cita.count({ where: { estado: 'pendiente' } });
    expect(await CitaOcupacion.count()).toBe(pendientes * 2);
  });

  describe('los índices únicos funcionan aunque se salte la lógica de la aplicación', () => {
    async function crearCitasSueltas(cantidad) {
      const citas = [];
      for (let i = 0; i < cantidad; i += 1) {
        const [recursos] = await crearRecursos(1);
        const cita = await Cita.create({
          folio: `CIT-2026-8${String((folioSuelto += 1)).padStart(5, '0')}`,
          ...recursos,
          fecha: LUNES,
          hora_inicio: '09:00',
          hora_fin: '09:30',
          duracion_slots: 1,
        });
        citas.push({ cita, recursos });
      }
      return citas;
    }

    const ocupar = ({ cita, recursos }, sobreescribir = {}) =>
      CitaOcupacion.create({ cita_id: cita.id, fecha: LUNES, slot: 4, ...recursos, ...sobreescribir });

    test('CP-INT-216 10 inserciones paralelas del mismo bloque de sala: la base rechaza todas menos una', async () => {
      const citas = await crearCitasSueltas(10);
      const salaCompartida = citas[0].recursos.sala_id;

      const resultados = await Promise.allSettled(
        citas.map((c) => ocupar(c, { sala_id: salaCompartida }))
      );

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rechazos = resultados.filter((r) => r.status === 'rejected');
      expect(rechazos).toHaveLength(9);
      rechazos.forEach((r) => expect(r.reason.name).toBe('SequelizeUniqueConstraintError'));
    });

    test('CP-INT-216 lo mismo para terapeuta y para paciente', async () => {
      const porTerapeuta = await crearCitasSueltas(6);
      const terapeutaCompartido = porTerapeuta[0].recursos.terapeuta_id;
      const t = await Promise.allSettled(porTerapeuta.map((c) => ocupar(c, { terapeuta_id: terapeutaCompartido })));
      expect(t.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const porPaciente = await crearCitasSueltas(6);
      const pacienteCompartido = porPaciente[0].recursos.paciente_id;
      const p = await Promise.allSettled(porPaciente.map((c) => ocupar(c, { paciente_id: pacienteCompartido, slot: 7 })));
      expect(p.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    test('CP-INT-217 bloques distintos o días distintos del mismo recurso sí caben', async () => {
      const [a, b, c] = await crearCitasSueltas(3);
      const sala_id = a.recursos.sala_id;

      await ocupar(a, { sala_id, slot: 4 });
      await expect(ocupar(b, { sala_id, slot: 5 })).resolves.toBeTruthy();
      await expect(ocupar(c, { sala_id, slot: 4, fecha: '2026-10-20' })).resolves.toBeTruthy();
      await expect(ocupar(b, { sala_id, slot: 4 })).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
    });

    test('CP-INT-218 si la revisión previa no ve el conflicto (carrera), el índice único lo detiene con un 409 claro', async () => {
      const [recursosA, recursosB] = await crearRecursos(2);
      const primera = await agendar({ ...base, ...recursosA });
      expect(primera.status).toBe(201);

      // Se simula que la revisión de conflictos "no ve" la cita ganadora: solo el índice único puede detenerla.
      const original = CitaOcupacion.findAll.bind(CitaOcupacion);
      const espia = jest.spyOn(CitaOcupacion, 'findAll').mockImplementationOnce(async () => []);

      const perdedora = await agendar({ ...base, ...recursosB, sala_id: recursosA.sala_id });
      espia.mockRestore();
      expect(original).toBeTruthy();

      expect(perdedora.status).toBe(409);
      expect(perdedora.body.message).toBe('La sala ya está ocupada en ese horario.');
      expect(await Cita.count()).toBe(1);
      expect(await CitaOcupacion.count()).toBe(2);
      // La transacción revertida devolvió también el folio: el siguiente es el 2, sin hueco.
      const siguiente = await agendar({ ...base, ...recursosB, hora_inicio: '11:00' });
      expect(siguiente.body.data.folio).toBe('CIT-2026-000002');
    });

    test('CP-INT-219 no se puede borrar físicamente una sala, terapeuta o paciente que tuvo citas (RESTRICT)', async () => {
      const [recursosA] = await crearRecursos(1);
      expect((await agendar({ ...base, ...recursosA })).status).toBe(201);

      const { Sala, Terapeuta, Paciente } = require('../src/config/database');
      await expect(Sala.destroy({ where: { id: recursosA.sala_id }, force: true })).rejects.toMatchObject({
        name: 'SequelizeForeignKeyConstraintError',
      });
      await expect(Terapeuta.destroy({ where: { id: recursosA.terapeuta_id }, force: true })).rejects.toMatchObject({
        name: 'SequelizeForeignKeyConstraintError',
      });
      await expect(Paciente.destroy({ where: { id: recursosA.paciente_id }, force: true })).rejects.toMatchObject({
        name: 'SequelizeForeignKeyConstraintError',
      });
    });

    test('CP-INT-219 el dialecto de la prueba se reporta (SQLite o PostgreSQL)', () => {
      expect(['sqlite', 'postgres']).toContain(sequelize.getDialect());
    });
  });
});
