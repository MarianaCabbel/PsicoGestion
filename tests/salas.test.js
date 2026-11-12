const request = require('supertest');
const { ConnectionRefusedError } = require('sequelize');
const app = require('../src/app');
const { Sala, User, AuditLog } = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { registrarGuardsDeCitas } = require('../src/modules/citas/citas.guards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { crearPaciente, crearTerapeutaConHorario, crearSala, insertarCita, enMerida } = require('./fixtures');

describe('Módulo de salas', () => {
  useTestDatabase();

  let token;

  beforeEach(async () => {
    registrarGuardsDeCitas();
    reloj.fijarAhora(enMerida('2026-10-16', '08:00')); // viernes
    token = await loginAs(app);
  });

  const crear = (nombre, t = token) => request(app).post('/api/salas').set(bearer(t)).send({ nombre });

  describe('alta y validaciones', () => {
    test('CP-INT-90 registra una sala y la devuelve activa', async () => {
      const res = await crear('Sala 1');

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ nombre: 'Sala 1', estado: 'activa' });
    });

    test('CP-INT-90 exige autenticación', async () => {
      const res = await request(app).post('/api/salas').send({ nombre: 'Sala 1' });
      expect(res.status).toBe(401);
    });

    test('CP-INT-91 el nombre admite máximo 10 caracteres (el límite exacto sí)', async () => {
      expect((await crear('1234567890')).status).toBe(201);

      const largo = await crear('12345678901');
      expect(largo.status).toBe(400);
      expect(largo.body.errors.nombre).toBe('El nombre de la sala no puede exceder 10 caracteres.');
    });

    test('CP-INT-91 rechaza nombre vacío, ausente o con símbolos', async () => {
      expect((await crear('   ')).status).toBe(400);
      expect((await request(app).post('/api/salas').set(bearer(token)).send({})).status).toBe(400);

      const simbolos = await crear('<b>Sal</b>');
      expect(simbolos.status).toBe(400);
      expect(simbolos.body.errors.nombre).toMatch(/solo puede contener/);
    });

    test('CP-INT-92 el nombre es único sin distinguir mayúsculas, acentos ni espacios repetidos', async () => {
      await crear('Sala A');

      for (const variante of ['SALA A', 'sala  a', 'Sála A']) {
        const res = await crear(variante);
        expect(res.status).toBe(409);
        expect(res.body.errors.nombre).toBe('Ya existe una sala con ese nombre.');
      }
    });

    test('CP-INT-92 el nombre de una sala dada de baja sigue ocupado', async () => {
      const id = (await crear('Sala A')).body.data.id;
      await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });

      const res = await crear('sala a');
      expect(res.status).toBe(409);
      expect(res.body.errors.nombre).toMatch(/dada de baja/);
    });
  });

  describe('consulta', () => {
    test('CP-INT-93 lista ordenada por nombre con búsqueda y paginación', async () => {
      await crear('Sala C');
      await crear('Sala A');
      await crear('Sala B');

      const todas = await request(app).get('/api/salas').set(bearer(token));
      expect(todas.body.data.items.map((s) => s.nombre)).toEqual(['Sala A', 'Sala B', 'Sala C']);

      const pagina = await request(app).get('/api/salas?limit=2&page=2').set(bearer(token));
      expect(pagina.body.data.items.map((s) => s.nombre)).toEqual(['Sala C']);
      expect(pagina.body.data.total).toBe(3);

      const busqueda = await request(app).get('/api/salas?q=sala b').set(bearer(token));
      expect(busqueda.body.data.items.map((s) => s.nombre)).toEqual(['Sala B']);
    });

    test('CP-INT-94 la lista muestra las citas de hoy y si la sala está ocupada ahora', async () => {
      reloj.fijarAhora(enMerida('2026-10-19', '09:15')); // lunes, a media cita de 09:00–10:00
      const sala = await crearSala('Sala A');
      const otra = await crearSala('Sala B');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19', hora_inicio: '09:00' });
      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19', hora_inicio: '12:00' });
      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-20', hora_inicio: '09:00' });

      const res = await request(app).get('/api/salas').set(bearer(token));
      const porNombre = Object.fromEntries(res.body.data.items.map((s) => [s.nombre, s]));

      expect(porNombre['Sala A']).toMatchObject({ citas_hoy: 2, ocupada_ahora: true });
      expect(porNombre['Sala B']).toMatchObject({ citas_hoy: 0, ocupada_ahora: false });
      expect(otra.id).toBeTruthy();
    });

    test('CP-INT-94 una sala no está ocupada fuera del bloque de su cita', async () => {
      reloj.fijarAhora(enMerida('2026-10-19', '10:00')); // la cita de 09:00–10:00 ya terminó
      const sala = await crearSala('Sala A');
      await insertarCita({
        paciente: await crearPaciente(),
        terapeuta: await crearTerapeutaConHorario(),
        sala,
        fecha: '2026-10-19',
        hora_inicio: '09:00',
      });

      const res = await request(app).get('/api/salas').set(bearer(token));
      expect(res.body.data.items[0].ocupada_ahora).toBe(false);
    });

    test('CP-INT-95 obtiene una sala, 404 si no existe y 400 si el id es inválido', async () => {
      const id = (await crear('Sala A')).body.data.id;

      expect((await request(app).get(`/api/salas/${id}`).set(bearer(token))).body.data.nombre).toBe('Sala A');
      expect((await request(app).get('/api/salas/9999').set(bearer(token))).status).toBe(404);
      expect((await request(app).get('/api/salas/abc').set(bearer(token))).status).toBe(400);
    });
  });

  describe('baja lógica y reactivación', () => {
    test('CP-INT-96 exige confirmación explícita y conserva el registro (baja lógica)', async () => {
      const id = (await crear('Sala A')).body.data.id;

      expect((await request(app).delete(`/api/salas/${id}`).set(bearer(token))).status).toBe(400);

      const baja = await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(baja.status).toBe(200);
      expect(await Sala.count()).toBe(0);
      expect(await Sala.count({ paranoid: false })).toBe(1);

      const bajas = await request(app).get('/api/salas?estado=baja').set(bearer(token));
      expect(bajas.body.data.items[0]).toMatchObject({ nombre: 'Sala A', estado: 'baja' });

      const otraVez = await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(otraVez.status).toBe(409);
    });

    test('CP-INT-97 no se puede dar de baja una sala con citas pendientes futuras', async () => {
      const sala = await crearSala('Sala A');
      await insertarCita({
        paciente: await crearPaciente(),
        terapeuta: await crearTerapeutaConHorario(),
        sala,
        fecha: '2026-10-19',
        folio: 'CIT-2026-000007',
      });

      const res = await request(app).delete(`/api/salas/${sala.id}`).set(bearer(token)).send({ confirmar: true });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/1 cita\(s\) pendiente\(s\) futura\(s\) \(CIT-2026-000007\)/);
      expect(await Sala.count()).toBe(1);
    });

    test('CP-INT-97 sí se puede si solo hay citas canceladas o vencidas', async () => {
      const sala = await crearSala('Sala A');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19', estado: 'cancelada' });
      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-14' }); // ya pasó: vencida

      const res = await request(app).delete(`/api/salas/${sala.id}`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(200);
    });

    test('CP-INT-97 una cita de hoy que ya terminó no bloquea la baja, una en curso sí', async () => {
      reloj.fijarAhora(enMerida('2026-10-19', '10:30'));
      const sala = await crearSala('Sala A');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-19', hora_inicio: '09:00' }); // terminó 10:00
      expect(
        (await request(app).delete(`/api/salas/${sala.id}`).set(bearer(token)).send({ confirmar: true })).status
      ).toBe(200);

      const otra = await crearSala('Sala B');
      await insertarCita({ paciente, terapeuta, sala: otra, fecha: '2026-10-19', hora_inicio: '10:00' }); // en curso
      expect(
        (await request(app).delete(`/api/salas/${otra.id}`).set(bearer(token)).send({ confirmar: true })).status
      ).toBe(409);
    });

    test('CP-INT-98 solo un administrador reactiva una sala', async () => {
      const id = (await crear('Sala A')).body.data.id;
      await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });

      expect((await request(app).post(`/api/salas/${id}/reactivar`).set(bearer(token))).status).toBe(403);

      await User.update({ rol: 'administrador' }, { where: {} });
      const res = await request(app).post(`/api/salas/${id}/reactivar`).set(bearer(token));
      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('activa');
      expect((await request(app).post(`/api/salas/${id}/reactivar`).set(bearer(token))).status).toBe(409);
    });
  });

  describe('edición', () => {
    const editar = (id, nombre, t = token) =>
      request(app).put(`/api/salas/${id}`).set(bearer(t)).send({ nombre });

    test('CP-INT-102 actualiza el nombre y registra auditoría', async () => {
      const id = (await crear('Sala A')).body.data.id;

      const res = await editar(id, 'Sala B');

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id, nombre: 'Sala B', estado: 'activa' });
      expect((await Sala.findByPk(id)).nombre_norm).toBe('sala b');

      const registros = await AuditLog.findAll({ where: { entidad: 'sala', accion: 'actualizar' } });
      expect(registros).toHaveLength(1);
      expect(registros[0].entidad_id).toBe(id);
    });

    test('CP-INT-102 rechaza más de 10 caracteres o vacío sin tocar el registro', async () => {
      const id = (await crear('Sala A')).body.data.id;

      const largo = await editar(id, '12345678901');
      expect(largo.status).toBe(400);
      expect(largo.body.errors.nombre).toBe('El nombre de la sala no puede exceder 10 caracteres.');
      expect((await editar(id, '   ')).status).toBe(400);
      expect((await Sala.findByPk(id)).nombre).toBe('Sala A');
    });

    test('CP-INT-102 rechaza un nombre usado por otra sala, sin distinguir formato', async () => {
      await crear('Sala A');
      const id = (await crear('Sala B')).body.data.id;

      for (const variante of ['SALA A', 'sála  a']) {
        const res = await editar(id, variante);
        expect(res.status).toBe(409);
        expect(res.body.errors.nombre).toBe('Ya existe una sala con ese nombre.');
      }
      expect((await Sala.findByPk(id)).nombre).toBe('Sala B');
    });

    test('CP-INT-102 permite conservar el propio nombre con otra capitalización', async () => {
      const id = (await crear('Sala A')).body.data.id;

      const res = await editar(id, 'sala a');

      expect(res.status).toBe(200);
      expect(res.body.data.nombre).toBe('sala a');
      expect(await Sala.count()).toBe(1);
    });

    test('CP-INT-102 no edita una sala dada de baja ni una inexistente', async () => {
      const id = (await crear('Sala A')).body.data.id;
      await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });

      const baja = await editar(id, 'Sala B');
      expect(baja.status).toBe(409);
      expect(baja.body.message).toMatch(/dada de baja/);
      expect((await editar(9999, 'Sala B')).status).toBe(404);
    });

    test('CP-INT-103 un error de conexión responde 503, conserva el nombre y permite reintentar', async () => {
      const id = (await crear('Sala A')).body.data.id;
      const espia = jest
        .spyOn(Sala, 'findOne')
        .mockRejectedValueOnce(new ConnectionRefusedError(new Error('sin red')));

      const res = await editar(id, 'Sala B');
      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/conexión/);
      expect((await Sala.findByPk(id)).nombre).toBe('Sala A');

      espia.mockRestore();
      const reintento = await editar(id, 'Sala B');
      expect(reintento.status).toBe(200);
    });

    test('CP-INT-104 secretaria y administrador pueden editar', async () => {
      const id = (await crear('Sala A')).body.data.id;
      expect((await editar(id, 'Sala B')).status).toBe(200);

      await User.update({ rol: 'administrador' }, { where: {} });
      expect((await editar(id, 'Sala C')).status).toBe(200);
    });
  });

  describe('disponibilidad', () => {
    test('CP-INT-99 muestra los bloques ocupados de cada sala en un día', async () => {
      const salaA = await crearSala('Sala A');
      await crearSala('Sala B');
      await insertarCita({
        paciente: await crearPaciente(),
        terapeuta: await crearTerapeutaConHorario(),
        sala: salaA,
        fecha: '2026-10-20',
        hora_inicio: '09:00',
        duracion_slots: 2,
      });

      const res = await request(app).get('/api/salas/disponibilidad?fecha=2026-10-20').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ fecha: '2026-10-20', dia_atencion: true, num_slots: 24 });

      const [a, b] = res.body.data.salas;
      expect(a).toMatchObject({
        nombre: 'Sala A',
        ocupados: [4, 5],
        horas_ocupadas: ['09:00', '09:30'],
        libres: 22,
        estado_dia: 'reservada',
      });
      expect(b).toMatchObject({ nombre: 'Sala B', ocupados: [], libres: 24, estado_dia: 'libre' });
    });

    test('CP-INT-99 no cuenta las citas canceladas y marca los días sin atención', async () => {
      const sala = await crearSala('Sala A');
      await insertarCita({
        paciente: await crearPaciente(),
        terapeuta: await crearTerapeutaConHorario(),
        sala,
        fecha: '2026-10-20',
        estado: 'cancelada',
      });

      const lunes = await request(app).get('/api/salas/disponibilidad?fecha=2026-10-20').set(bearer(token));
      expect(lunes.body.data.salas[0].ocupados).toEqual([]);

      const domingo = await request(app).get('/api/salas/disponibilidad?fecha=2026-10-25').set(bearer(token));
      expect(domingo.body.data.dia_atencion).toBe(false);
    });

    test('CP-INT-99 la ruta /disponibilidad no se confunde con un identificador y valida la fecha', async () => {
      expect((await request(app).get('/api/salas/disponibilidad').set(bearer(token))).status).toBe(400);
      expect((await request(app).get('/api/salas/disponibilidad?fecha=2026-02-30').set(bearer(token))).status).toBe(400);
    });

    test('CP-INT-100 clasifica cada día como libre o reservada y conserva el nivel de ocupación', async () => {
      const sala = await crearSala('Sala A');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      // Martes 20: una cita (reservada, nivel parcial). Miércoles 21: seis citas de 2 h cubren los 24 bloques.
      await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-20', hora_inicio: '09:00' });
      for (const hora of ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00']) {
        await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-21', hora_inicio: hora, duracion_slots: 4 });
      }

      const res = await request(app)
        .get(`/api/salas/${sala.id}/disponibilidad?desde=2026-10-19&hasta=2026-10-22`)
        .set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.dias.map((d) => [d.fecha, d.estado, d.nivel, d.slots_ocupados])).toEqual([
        ['2026-10-19', 'libre', 'libre', 0],
        ['2026-10-20', 'reservada', 'parcial', 2],
        ['2026-10-21', 'reservada', 'completa', 24],
        ['2026-10-22', 'libre', 'libre', 0],
      ]);
    });

    test('CP-INT-100 valida el rango: orden de fechas, máximo 62 días y sala existente', async () => {
      const sala = await crearSala('Sala A');

      const invertido = await request(app)
        .get(`/api/salas/${sala.id}/disponibilidad?desde=2026-10-22&hasta=2026-10-19`)
        .set(bearer(token));
      expect(invertido.status).toBe(400);
      expect(invertido.body.errors.hasta).toBe('La fecha final no puede ser anterior a la inicial.');

      const largo = await request(app)
        .get(`/api/salas/${sala.id}/disponibilidad?desde=2026-10-01&hasta=2026-12-31`)
        .set(bearer(token));
      expect(largo.status).toBe(400);
      expect(largo.body.errors.hasta).toBe('El rango no puede exceder 62 días.');

      const justo = await request(app)
        .get(`/api/salas/${sala.id}/disponibilidad?desde=2026-10-01&hasta=2026-12-01`)
        .set(bearer(token));
      expect(justo.status).toBe(200);
      expect(justo.body.data.dias).toHaveLength(62);

      const inexistente = await request(app)
        .get('/api/salas/9999/disponibilidad?desde=2026-10-01&hasta=2026-10-02')
        .set(bearer(token));
      expect(inexistente.status).toBe(404);
    });

    const agendar = (cuerpo) => request(app).post('/api/citas').set(bearer(token)).send(cuerpo);

    test('CP-INT-105 agendar una cita marca la sala como reservada ese día (CP3-52)', async () => {
      const sala = await crearSala('Sala A');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      const cita = await agendar({
        paciente_id: paciente.id,
        terapeuta_id: terapeuta.id,
        sala_id: sala.id,
        fecha: '2026-10-19',
        hora_inicio: '09:00',
        duracion_slots: 2,
      });
      expect(cita.status).toBe(201);

      const dia = await request(app)
        .get('/api/salas/disponibilidad?fecha=2026-10-19')
        .set(bearer(token));
      expect(dia.body.data.salas[0]).toMatchObject({ nombre: 'Sala A', estado_dia: 'reservada' });

      const rango = await request(app)
        .get(`/api/salas/${sala.id}/disponibilidad?desde=2026-10-19&hasta=2026-10-19`)
        .set(bearer(token));
      expect(rango.body.data.dias[0]).toMatchObject({
        estado: 'reservada',
        nivel: 'parcial',
        slots_ocupados: 2,
      });
    });

    test('CP-INT-106 cancelar libera la sala y permite reagendar (CP3-51)', async () => {
      const sala = await crearSala('Sala A');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();
      const cuerpo = {
        paciente_id: paciente.id,
        terapeuta_id: terapeuta.id,
        sala_id: sala.id,
        fecha: '2026-10-19',
        hora_inicio: '09:00',
        duracion_slots: 2,
      };

      const cita = await agendar(cuerpo);
      expect(cita.status).toBe(201);

      const cancelada = await request(app)
        .post(`/api/citas/${cita.body.data.id}/cancelar`)
        .set(bearer(token))
        .send({ confirmar: true });
      expect(cancelada.status).toBe(200);

      const dia = await request(app)
        .get('/api/salas/disponibilidad?fecha=2026-10-19')
        .set(bearer(token));
      expect(dia.body.data.salas[0].estado_dia).toBe('libre');

      expect((await agendar(cuerpo)).status).toBe(201);
    });

    test('CP-INT-107 cambiar la cita de sala libera la anterior y reserva la nueva (CP3-53)', async () => {
      const salaA = await crearSala('Sala A');
      const salaB = await crearSala('Sala B');
      const terapeuta = await crearTerapeutaConHorario();
      const paciente = await crearPaciente();

      const cita = await agendar({
        paciente_id: paciente.id,
        terapeuta_id: terapeuta.id,
        sala_id: salaA.id,
        fecha: '2026-10-19',
        hora_inicio: '09:00',
        duracion_slots: 2,
      });
      expect(cita.status).toBe(201);

      const cambio = await request(app)
        .put(`/api/citas/${cita.body.data.id}`)
        .set(bearer(token))
        .send({ sala_id: salaB.id });
      expect(cambio.status).toBe(200);

      const dia = await request(app)
        .get('/api/salas/disponibilidad?fecha=2026-10-19')
        .set(bearer(token));
      const porNombre = Object.fromEntries(dia.body.data.salas.map((s) => [s.nombre, s]));
      expect(porNombre['Sala A'].estado_dia).toBe('libre');
      expect(porNombre['Sala B'].estado_dia).toBe('reservada');
    });
  });

  test('CP-INT-101 la bitácora registra las operaciones de salas', async () => {
    const id = (await crear('Sala A')).body.data.id;
    await request(app).delete(`/api/salas/${id}`).set(bearer(token)).send({ confirmar: true });

    const registros = await AuditLog.findAll({ where: { entidad: 'sala' }, order: [['id', 'ASC']] });
    expect(registros.map((r) => r.accion)).toEqual(['crear', 'baja']);
  });
});
