const request = require('supertest');
const app = require('../src/app');
const { Cita, CitaOcupacion, Notificacion, AuditLog, FolioCounter, TerapeutaHorario } = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { registrarGuardsDeCitas } = require('../src/modules/citas/citas.guards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { crearPaciente, crearTerapeutaConHorario, crearSala, insertarCita, enMerida } = require('./fixtures');

const LUNES = '2026-10-19';
const MARTES = '2026-10-20';

describe('Módulo de citas', () => {
  useTestDatabase();

  let token;
  let paciente;
  let terapeuta;
  let sala;
  let otraSala;

  beforeEach(async () => {
    registrarGuardsDeCitas();
    reloj.fijarAhora(enMerida('2026-10-16', '08:00')); // viernes 16 de octubre, 08:00 en Mérida
    token = await loginAs(app);
    paciente = await crearPaciente();
    terapeuta = await crearTerapeutaConHorario();
    sala = await crearSala('Sala A');
    otraSala = await crearSala('Sala B');
  });

  const datos = (extra = {}) => ({
    paciente_id: paciente.id,
    terapeuta_id: terapeuta.id,
    sala_id: sala.id,
    fecha: LUNES,
    hora_inicio: '09:00',
    ...extra,
  });

  const agendar = (extra = {}, t = token) => request(app).post('/api/citas').set(bearer(t)).send(datos(extra));

  /** Un juego completo de recursos distintos, para agendar a la misma hora sin conflicto. */
  async function recursosNuevos() {
    return {
      paciente_id: (await crearPaciente()).id,
      terapeuta_id: (await crearTerapeutaConHorario()).id,
      sala_id: (await crearSala(`S${Math.floor(Math.random() * 1e6)}`)).id,
    };
  }

  describe('agendar', () => {
    test('CP-INT-110 agenda una cita, genera folio y ocupa dos bloques de 30 min', async () => {
      const res = await agendar();

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        folio: 'CIT-2026-000001',
        estado: 'pendiente',
        fecha: LUNES,
        hora_inicio: '09:00',
        hora_fin: '10:00',
        duracion_slots: 2,
        duracion_minutos: 60,
        paciente: { id: paciente.id },
        terapeuta: { id: terapeuta.id },
        sala: { id: sala.id, nombre: 'Sala A' },
      });

      const ocupaciones = await CitaOcupacion.findAll({ where: { cita_id: res.body.data.id }, order: [['slot', 'ASC']] });
      expect(ocupaciones.map((o) => o.slot)).toEqual([4, 5]);
      expect(ocupaciones.every((o) => o.sala_id === sala.id && o.terapeuta_id === terapeuta.id && o.paciente_id === paciente.id)).toBe(true);
    });

    test('CP-INT-110 exige autenticación', async () => {
      expect((await request(app).post('/api/citas').send(datos())).status).toBe(401);
    });

    test('CP-INT-111 los folios son consecutivos y reinician cada año', async () => {
      const primera = await agendar();
      const segunda = await agendar({ hora_inicio: '11:00' });
      expect([primera.body.data.folio, segunda.body.data.folio]).toEqual(['CIT-2026-000001', 'CIT-2026-000002']);

      reloj.fijarAhora(enMerida('2027-01-04', '08:00'));
      const nuevoAnio = await agendar({ fecha: '2027-01-05' });
      expect(nuevoAnio.body.data.folio).toBe('CIT-2027-000001');
    });

    test('CP-INT-111 una cita rechazada no consume folio ni deja filas a medias', async () => {
      await agendar();
      const rechazada = await agendar({ paciente_id: (await crearPaciente()).id });
      expect(rechazada.status).toBe(409);

      expect(await Cita.count()).toBe(1);
      expect(await CitaOcupacion.count()).toBe(2);
      expect((await FolioCounter.findByPk(2026)).ultimo).toBe(1);

      const siguiente = await agendar({ hora_inicio: '11:00' });
      expect(siguiente.body.data.folio).toBe('CIT-2026-000002');
    });

    test('CP-INT-112 respeta la duración indicada y su máximo', async () => {
      const tres = await agendar({ duracion_slots: 3 });
      expect(tres.body.data).toMatchObject({ hora_fin: '10:30', duracion_minutos: 90 });
      expect(await CitaOcupacion.count({ where: { cita_id: tres.body.data.id } })).toBe(3);

      const cinco = await agendar({ hora_inicio: '12:00', duracion_slots: 5 });
      expect(cinco.status).toBe(400);
      expect(cinco.body.errors.duracion_slots).toBe('La duración máxima es de 4 bloques.');
    });

    test('CP-INT-113 valida campos obligatorios con errores por campo', async () => {
      const res = await request(app).post('/api/citas').set(bearer(token)).send({});

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errors)).toEqual(
        expect.arrayContaining(['paciente_id', 'terapeuta_id', 'sala_id', 'fecha', 'hora_inicio'])
      );
    });

    test('CP-INT-114 paciente, terapeuta o sala inexistentes responden 404 y dados de baja 409', async () => {
      const faltante = await agendar({ paciente_id: 99999 });
      expect(faltante.status).toBe(404);
      expect(faltante.body.errors.paciente_id).toBe('El paciente seleccionado no existe.');

      await paciente.destroy();
      const baja = await agendar();
      expect(baja.status).toBe(409);
      expect(baja.body.errors.paciente_id).toBe('El paciente seleccionado está dado de baja.');
    });

    test('CP-INT-114 un terapeuta o sala dados de baja no se pueden agendar', async () => {
      await terapeuta.destroy();
      const t = await agendar();
      expect(t.status).toBe(409);
      expect(t.body.errors.terapeuta_id).toBe('El terapeuta seleccionado está dado de baja.');

      const nuevoT = await crearTerapeutaConHorario();
      await sala.destroy();
      const s = await agendar({ terapeuta_id: nuevoT.id });
      expect(s.status).toBe(409);
      expect(s.body.errors.sala_id).toBe('La sala seleccionada está dada de baja.');
    });
  });

  describe('reglas de calendario', () => {
    test('CP-INT-115 no permite fechas pasadas', async () => {
      const res = await agendar({ fecha: '2026-10-15' });

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha).toBe('No se pueden agendar citas en fechas pasadas.');
    });

    test('CP-INT-115 hoy solo permite horas posteriores a la actual', async () => {
      const pasada = await agendar({ fecha: '2026-10-16', hora_inicio: '08:00' });
      expect(pasada.status).toBe(400);
      expect(pasada.body.errors.hora_inicio).toBe('La hora de la cita ya pasó.');

      const futura = await agendar({ fecha: '2026-10-16', hora_inicio: '08:30' });
      expect(futura.status).toBe(201);
    });

    test('CP-INT-116 no se agenda en días sin atención (sábado y domingo)', async () => {
      for (const fecha of ['2026-10-17', '2026-10-18']) {
        const res = await agendar({ fecha });
        expect(res.status).toBe(400);
        expect(res.body.errors.fecha).toBe('La clínica no atiende ese día de la semana.');
      }
    });

    test.each([
      ['06:30', 'hora_inicio'],
      ['19:00', 'hora_inicio'],
      ['09:15', 'hora_inicio'],
      ['8am', 'hora_inicio'],
    ])('CP-INT-117 rechaza la hora %s', async (hora, campo) => {
      const res = await agendar({ hora_inicio: hora });
      expect(res.status).toBe(400);
      expect(res.body.errors[campo]).toBeTruthy();
    });

    test('CP-INT-117 una cita que terminaría después de las 19:00 se rechaza; la última del día cabe', async () => {
      const tarde = await agendar({ hora_inicio: '18:30', duracion_slots: 2 });
      expect(tarde.status).toBe(400);
      expect(tarde.body.errors.duracion_slots).toBe('La cita terminaría después del cierre (19:00).');

      const ultima = await agendar({ hora_inicio: '18:30', duracion_slots: 1 });
      expect(ultima.status).toBe(201);
      expect(ultima.body.data.hora_fin).toBe('19:00');
    });

    test('CP-INT-118 solo se agenda dentro del horario semanal del terapeuta', async () => {
      const acotado = await crearTerapeutaConHorario({}, [{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' }]);

      const antes = await agendar({ terapeuta_id: acotado.id, hora_inicio: '08:30' });
      expect(antes.status).toBe(400);
      expect(antes.body.errors.hora_inicio).toBe('El terapeuta no atiende en ese horario.');

      const sePasa = await agendar({ terapeuta_id: acotado.id, hora_inicio: '11:30', duracion_slots: 2 });
      expect(sePasa.status).toBe(400);

      const justo = await agendar({ terapeuta_id: acotado.id, hora_inicio: '11:00', duracion_slots: 2 });
      expect(justo.status).toBe(201);
    });

    test('CP-INT-118 un día sin horario configurado no se puede agendar', async () => {
      const acotado = await crearTerapeutaConHorario({}, [{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' }]);

      const res = await agendar({ terapeuta_id: acotado.id, fecha: MARTES });
      expect(res.status).toBe(400);
      expect(res.body.errors.terapeuta_id).toBe('El terapeuta no tiene horario configurado para ese día.');
    });

    test('CP-INT-118 las franjas contiguas del terapeuta se tratan como un solo bloque', async () => {
      const partido = await crearTerapeutaConHorario({}, [
        { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: 1, hora_inicio: '10:00', hora_fin: '12:00' },
      ]);

      const cruza = await agendar({ terapeuta_id: partido.id, hora_inicio: '09:30', duracion_slots: 2 });
      expect(cruza.status).toBe(201);
    });
  });

  describe('anti-traslape', () => {
    beforeEach(async () => {
      expect((await agendar()).status).toBe(201); // lunes 09:00–10:00 con sala A, terapeuta y paciente base
    });

    test('CP-INT-120 rechaza una sala ocupada', async () => {
      const otro = await recursosNuevos();
      const res = await agendar({ ...otro, sala_id: sala.id });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('La sala ya está ocupada en ese horario.');
      expect(res.body.errors).toEqual({ sala_id: 'La sala ya está ocupada en ese horario.' });
    });

    test('CP-INT-120 rechaza un terapeuta ocupado', async () => {
      const otro = await recursosNuevos();
      const res = await agendar({ ...otro, terapeuta_id: terapeuta.id });

      expect(res.status).toBe(409);
      expect(res.body.errors).toEqual({ terapeuta_id: 'El terapeuta ya tiene una cita en ese horario.' });
    });

    test('CP-INT-120 rechaza un paciente que ya tiene otra cita a esa hora', async () => {
      const otro = await recursosNuevos();
      const res = await agendar({ ...otro, paciente_id: paciente.id });

      expect(res.status).toBe(409);
      expect(res.body.errors).toEqual({ paciente_id: 'El paciente ya tiene una cita en ese horario.' });
    });

    test('CP-INT-120 informa todos los recursos en conflicto a la vez', async () => {
      const res = await agendar();

      expect(res.status).toBe(409);
      expect(Object.keys(res.body.errors).sort()).toEqual(['paciente_id', 'sala_id', 'terapeuta_id']);
      expect(res.body.message).toBe('La sala ya está ocupada en ese horario.');
    });

    test('CP-INT-121 un traslape parcial también se rechaza (inicio dentro de la cita existente)', async () => {
      const otro = await recursosNuevos();
      const res = await agendar({ ...otro, sala_id: sala.id, hora_inicio: '09:30' });

      expect(res.status).toBe(409);
    });

    test('CP-INT-121 un traslape por el final también se rechaza', async () => {
      const otro = await recursosNuevos();
      const res = await agendar({ ...otro, sala_id: sala.id, hora_inicio: '08:30', duracion_slots: 2 });

      expect(res.status).toBe(409);
    });

    test('CP-INT-121 una cita contenida dentro de otra más larga también choca', async () => {
      const otro = await recursosNuevos();
      const larga = await agendar({ ...otro, hora_inicio: '13:00', duracion_slots: 4 });
      expect(larga.status).toBe(201);

      const dentro = await agendar({ ...(await recursosNuevos()), sala_id: otro.sala_id, hora_inicio: '13:30', duracion_slots: 1 });
      expect(dentro.status).toBe(409);
    });

    test('CP-INT-122 citas contiguas (una termina cuando empieza la otra) sí se permiten', async () => {
      const despues = await agendar({ hora_inicio: '10:00' });
      expect(despues.status).toBe(201);

      const antes = await agendar({ hora_inicio: '08:00' });
      expect(antes.status).toBe(201);
    });

    test('CP-INT-122 la misma hora con recursos distintos no choca', async () => {
      const otro = await recursosNuevos();
      expect((await agendar(otro)).status).toBe(201);
    });

    test('CP-INT-122 el mismo horario en otro día no choca', async () => {
      expect((await agendar({ fecha: MARTES })).status).toBe(201);
    });

    test('CP-INT-123 una cita cancelada libera sala, terapeuta y paciente', async () => {
      const original = await Cita.findOne();
      await request(app).post(`/api/citas/${original.id}/cancelar`).set(bearer(token)).send({ confirmar: true });

      const reagendada = await agendar();
      expect(reagendada.status).toBe(201);
    });

    test('CP-INT-123 una cita cancelada no bloquea y la base nunca guarda ocupaciones de canceladas', async () => {
      const original = await Cita.findOne();
      await request(app).post(`/api/citas/${original.id}/cancelar`).set(bearer(token)).send({ confirmar: true });

      expect(await CitaOcupacion.count({ where: { cita_id: original.id } })).toBe(0);
    });
  });

  describe('consulta y listados', () => {
    test('CP-INT-130 obtiene el detalle por id y por folio con el estado del correo', async () => {
      const creada = (await agendar()).body.data;

      const porId = await request(app).get(`/api/citas/${creada.id}`).set(bearer(token));
      expect(porId.status).toBe(200);
      expect(porId.body.data).toMatchObject({
        folio: creada.folio,
        paciente_tiene_correo: true,
        notificacion: { estado: 'pendiente', intentos: 0 },
      });
      expect(porId.body.data.paciente.telefono).toBe('9991234567');

      const porFolio = await request(app).get(`/api/citas/folio/${creada.folio}`).set(bearer(token));
      expect(porFolio.body.data.id).toBe(creada.id);

      const minusculas = await request(app).get(`/api/citas/folio/${creada.folio.toLowerCase()}`).set(bearer(token));
      expect(minusculas.status).toBe(200);
    });

    test('CP-INT-130 400 por folio mal formado, 404 por folio o id inexistente', async () => {
      expect((await request(app).get('/api/citas/folio/ABC').set(bearer(token))).status).toBe(400);
      expect((await request(app).get('/api/citas/folio/CIT-2026-999999').set(bearer(token))).status).toBe(404);
      expect((await request(app).get('/api/citas/99999').set(bearer(token))).status).toBe(404);
    });

    describe('con varias citas', () => {
      let pasada;
      let cancelada;

      beforeEach(async () => {
        reloj.fijarAhora(enMerida(LUNES, '11:00')); // lunes 11:00
        const otroT = await crearTerapeutaConHorario();
        const otroP = await crearPaciente();

        pasada = await insertarCita({ paciente, terapeuta, sala, fecha: LUNES, hora_inicio: '09:00' }); // terminó 10:00
        await insertarCita({ paciente, terapeuta, sala, fecha: LUNES, hora_inicio: '12:00' }); // futura hoy
        await insertarCita({ paciente: otroP, terapeuta: otroT, sala: otraSala, fecha: MARTES, hora_inicio: '09:00' });
        await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-27', hora_inicio: '09:00' }); // semana siguiente
        cancelada = await insertarCita({ paciente: otroP, terapeuta: otroT, sala: otraSala, fecha: LUNES, hora_inicio: '15:00', estado: 'cancelada' });
      });

      const listar = (consulta) => request(app).get(`/api/citas?${consulta}`).set(bearer(token));

      test('CP-INT-131 categoriza por estado: pendiente, vencida, cancelada y todas', async () => {
        const pendientes = await listar('estado=pendiente');
        expect(pendientes.body.data.total).toBe(3);
        expect(pendientes.body.data.items.every((c) => c.estado === 'pendiente')).toBe(true);

        const vencidas = await listar('estado=vencida');
        expect(vencidas.body.data.items.map((c) => c.id)).toEqual([pasada.id]);
        expect(vencidas.body.data.items[0].estado).toBe('vencida');

        const canceladas = await listar('estado=cancelada');
        expect(canceladas.body.data.items.map((c) => c.id)).toEqual([cancelada.id]);

        const todas = await listar('');
        expect(todas.body.data.total).toBe(5);
      });

      test('CP-INT-131 una cita pasa de pendiente a vencida al avanzar el reloj', async () => {
        const antes = await listar('estado=vencida');
        expect(antes.body.data.total).toBe(1);

        reloj.fijarAhora(enMerida(LUNES, '13:00')); // terminó la de las 12:00

        const despues = await listar('estado=vencida');
        expect(despues.body.data.total).toBe(2);
      });

      test('CP-INT-132 filtra por rango: día, semana y mes', async () => {
        expect((await listar(`rango=dia&fecha=${LUNES}`)).body.data.total).toBe(3); // 09:00, 12:00 y la cancelada
        expect((await listar(`rango=semana&fecha=${MARTES}`)).body.data.total).toBe(4); // lunes 19 a domingo 25
        expect((await listar(`rango=mes&fecha=${LUNES}`)).body.data.total).toBe(5);
        expect((await listar('rango=mes&fecha=2026-11-10')).body.data.total).toBe(0);
      });

      test('CP-INT-132 filtra por fecha exacta y por desde/hasta', async () => {
        expect((await listar(`fecha=${MARTES}`)).body.data.total).toBe(1);
        expect((await listar('desde=2026-10-20&hasta=2026-10-26')).body.data.total).toBe(1);
        expect((await listar('desde=2026-10-20')).body.data.total).toBe(2);
        expect((await listar('hasta=2026-10-19')).body.data.total).toBe(3);
      });

      test('CP-INT-132 filtra por sala, terapeuta y paciente, y combina con el estado', async () => {
        expect((await listar(`sala_id=${otraSala.id}`)).body.data.total).toBe(2);
        expect((await listar(`terapeuta_id=${terapeuta.id}`)).body.data.total).toBe(3);
        expect((await listar(`paciente_id=${paciente.id}&estado=pendiente`)).body.data.total).toBe(2);
        expect((await listar(`sala_id=${otraSala.id}&estado=cancelada`)).body.data.total).toBe(1);
      });

      test('CP-INT-133 ordena cronológicamente (asc por defecto) y admite desc', async () => {
        const asc = await listar('');
        const claves = asc.body.data.items.map((c) => `${c.fecha} ${c.hora_inicio}`);
        expect(claves).toEqual([...claves].sort());

        const desc = await listar('orden=desc');
        expect(desc.body.data.items.map((c) => `${c.fecha} ${c.hora_inicio}`)).toEqual([...claves].reverse());
      });

      test('CP-INT-133 pagina el resultado e incluye nombres de paciente, terapeuta y sala', async () => {
        const res = await listar('limit=2&page=2');

        expect(res.body.data).toMatchObject({ page: 2, limit: 2, total: 5, total_paginas: 3 });
        expect(res.body.data.items).toHaveLength(2);
        expect(res.body.data.items[0].paciente.nombre_completo).toMatch(/^Paciente Número/);
        expect(res.body.data.items[0].sala.nombre).toBeTruthy();
        expect(res.body.data.items[0].paciente).not.toHaveProperty('telefono');
      });

      test('CP-INT-134 valida los parámetros de consulta', async () => {
        const sinFecha = await listar('rango=semana');
        expect(sinFecha.status).toBe(400);
        expect(sinFecha.body.errors.fecha).toBe('Indica la fecha de referencia del rango.');

        expect((await listar(`rango=semana&fecha=${LUNES}&desde=${LUNES}`)).status).toBe(400);
        expect((await listar('desde=2026-10-20&hasta=2026-10-19')).status).toBe(400);
        expect((await listar('estado=inventado')).status).toBe(400);
        expect((await listar('rango=anio&fecha=2026-10-19')).status).toBe(400);
        expect((await listar('limit=1000')).status).toBe(400);
      });

      test('CP-INT-135 el historial conserva el nombre de pacientes y salas dados de baja', async () => {
        await sala.destroy();
        const res = await listar(`estado=vencida`);

        expect(res.body.data.items[0].sala).toEqual({ id: sala.id, nombre: 'Sala A' });
      });
    });
  });

  describe('modificar', () => {
    let cita;

    beforeEach(async () => {
      cita = (await agendar()).body.data; // lunes 09:00–10:00
      await Notificacion.destroy({ where: {} });
    });

    const modificar = (cambios, id = cita.id) => request(app).put(`/api/citas/${id}`).set(bearer(token)).send(cambios);

    test('CP-INT-140 cambia la sala y libera la anterior', async () => {
      const res = await modificar({ sala_id: otraSala.id });

      expect(res.status).toBe(200);
      expect(res.body.data.sala.id).toBe(otraSala.id);

      const libre = await agendar({ ...(await recursosNuevos()), sala_id: sala.id });
      expect(libre.status).toBe(201);
    });

    test('CP-INT-140 mover la cita a un horario que se traslapa con el propio no choca consigo misma', async () => {
      const res = await modificar({ hora_inicio: '09:30' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ hora_inicio: '09:30', hora_fin: '10:30' });

      const slots = (await CitaOcupacion.findAll({ where: { cita_id: cita.id }, order: [['slot', 'ASC']] })).map((o) => o.slot);
      expect(slots).toEqual([5, 6]);
    });

    test('CP-INT-140 extiende la duración y cambia de día', async () => {
      const res = await modificar({ duracion_slots: 4, fecha: MARTES });

      expect(res.body.data).toMatchObject({ fecha: MARTES, hora_fin: '11:00', duracion_slots: 4 });
      expect(await CitaOcupacion.count({ where: { cita_id: cita.id } })).toBe(4);
    });

    test('CP-INT-141 un conflicto al modificar responde 409 y deja la cita intacta', async () => {
      const otro = await recursosNuevos();
      await agendar({ ...otro, hora_inicio: '11:00' }); // otra cita a las 11:00 con otros recursos
      const ocupacionesAntes = await CitaOcupacion.count();

      const res = await modificar({ sala_id: otro.sala_id, hora_inicio: '11:00' });
      expect(res.status).toBe(409);
      expect(res.body.errors.sala_id).toBe('La sala ya está ocupada en ese horario.');

      const intacta = await Cita.findByPk(cita.id);
      expect(intacta).toMatchObject({ hora_inicio: '09:00', sala_id: sala.id });
      expect(await CitaOcupacion.count()).toBe(ocupacionesAntes);
      expect(await CitaOcupacion.count({ where: { cita_id: cita.id } })).toBe(2);
    });

    test('CP-INT-141 aplica las reglas de calendario al nuevo horario', async () => {
      expect((await modificar({ fecha: '2026-10-17' })).status).toBe(400); // sábado
      expect((await modificar({ fecha: '2026-10-15' })).status).toBe(400); // pasado
      expect((await modificar({ hora_inicio: '18:30' })).status).toBe(400); // termina después del cierre
      expect((await modificar({ hora_inicio: '09:10' })).status).toBe(400);
    });

    test('CP-INT-141 cambiar de terapeuta exige que atienda en ese horario', async () => {
      const acotado = await crearTerapeutaConHorario({}, [{ dia_semana: 1, hora_inicio: '13:00', hora_fin: '16:00' }]);

      const res = await modificar({ terapeuta_id: acotado.id });
      expect(res.status).toBe(400);
      expect(res.body.errors.hora_inicio).toBe('El terapeuta no atiende en ese horario.');
    });

    test('CP-INT-142 cambiar de paciente valida que esté activo y avisa al nuevo', async () => {
      const nuevo = await crearPaciente({ correo: 'nuevo@correo.com' });

      const res = await modificar({ paciente_id: nuevo.id });
      expect(res.status).toBe(200);

      const aviso = await Notificacion.findOne();
      expect(aviso).toMatchObject({ tipo: 'modificacion', destinatario: 'nuevo@correo.com', estado: 'pendiente' });

      const dadoDeBaja = await crearPaciente();
      await dadoDeBaja.destroy();
      const rechazado = await modificar({ paciente_id: dadoDeBaja.id });
      expect(rechazado.status).toBe(409);
      expect(rechazado.body.errors.paciente_id).toBe('El paciente seleccionado está dado de baja.');
    });

    test('CP-INT-143 una modificación encola aviso al paciente; sin cambios reales no', async () => {
      await modificar({ sala_id: otraSala.id });
      expect(await Notificacion.count({ where: { tipo: 'modificacion' } })).toBe(1);

      await Notificacion.destroy({ where: {} });
      const igual = await modificar({ sala_id: otraSala.id, hora_inicio: '09:00' });
      expect(igual.status).toBe(200);
      expect(await Notificacion.count()).toBe(0);
    });

    test('CP-INT-144 no se modifica una cita cancelada ni vencida', async () => {
      await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      const cancelada = await modificar({ sala_id: otraSala.id });
      expect(cancelada.status).toBe(409);
      expect(cancelada.body.message).toBe('La cita está cancelada y no puede modificarse.');

      const vencida = await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-14' });
      const res = await modificar({ sala_id: otraSala.id }, vencida.id);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('La cita ya venció y no puede modificarse.');
    });

    test('CP-INT-144 rechaza cuerpo vacío, ids inválidos y citas inexistentes', async () => {
      expect((await modificar({})).status).toBe(400);
      expect((await modificar({ sala_id: 'x' })).status).toBe(400);
      expect((await modificar({ sala_id: 99999 })).status).toBe(404);
      expect((await modificar({ sala_id: otraSala.id }, 99999)).status).toBe(404);
    });
  });

  describe('cancelar', () => {
    let cita;

    beforeEach(async () => {
      cita = (await agendar()).body.data;
      await Notificacion.destroy({ where: {} });
    });

    test('CP-INT-150 exige confirmación explícita', async () => {
      expect((await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({})).status).toBe(400);
      expect((await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: false })).status).toBe(400);
      expect((await Cita.findByPk(cita.id)).estado).toBe('pendiente');
    });

    test('CP-INT-150 cancela por id: guarda motivo y fecha, libera bloques y avisa al paciente', async () => {
      const res = await request(app)
        .post(`/api/citas/${cita.id}/cancelar`)
        .set(bearer(token))
        .send({ confirmar: true, motivo: '  El paciente se enfermó ' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ estado: 'cancelada', motivo_cancelacion: 'El paciente se enfermó' });
      expect(res.body.data.cancelada_at).toBeTruthy();
      expect(await CitaOcupacion.count({ where: { cita_id: cita.id } })).toBe(0);
      expect(await Notificacion.count({ where: { tipo: 'cancelacion', estado: 'pendiente' } })).toBe(1);
    });

    test('CP-INT-151 cancela ingresando el folio', async () => {
      const res = await request(app)
        .post(`/api/citas/folio/${cita.folio.toLowerCase()}/cancelar`)
        .set(bearer(token))
        .send({ confirmar: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: cita.id, estado: 'cancelada' });

      const inexistente = await request(app)
        .post('/api/citas/folio/CIT-2026-999999/cancelar')
        .set(bearer(token))
        .send({ confirmar: true });
      expect(inexistente.status).toBe(404);
    });

    test('CP-INT-152 no se cancela dos veces ni una cita vencida', async () => {
      await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      const otraVez = await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      expect(otraVez.status).toBe(409);
      expect(otraVez.body.message).toBe('La cita ya está cancelada.');

      const vencida = await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-14' });
      const res = await request(app).post(`/api/citas/${vencida.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('La cita ya venció y no puede cancelarse.');
    });

    test('CP-INT-152 el motivo no puede exceder 255 caracteres', async () => {
      const res = await request(app)
        .post(`/api/citas/${cita.id}/cancelar`)
        .set(bearer(token))
        .send({ confirmar: true, motivo: 'x'.repeat(256) });
      expect(res.status).toBe(400);
    });

    test('CP-INT-153 sin correo del paciente no se encola aviso pero la cancelación procede', async () => {
      await paciente.update({ correo: null });

      const res = await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(200);
      expect(await Notificacion.count()).toBe(0);
    });
  });

  describe('disponibilidad para el formulario', () => {
    const disponibilidad = (consulta) => request(app).get(`/api/citas/disponibilidad?${consulta}`).set(bearer(token));
    const horas = (res) => res.body.data.inicios.map((i) => i.hora_inicio);

    let acotado;

    beforeEach(async () => {
      acotado = await crearTerapeutaConHorario({}, [
        { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: 1, hora_inicio: '10:00', hora_fin: '12:00' },
      ]);
    });

    test('CP-INT-160 ofrece solo inicios dentro del horario del terapeuta, con ambas salas libres', async () => {
      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ fecha: LUNES, duracion_slots: 2, slot_minutos: 30 });
      expect(horas(res)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
      expect(res.body.data.inicios[0]).toEqual({
        hora_inicio: '08:00',
        hora_fin: '09:00',
        salas_libres: [
          { id: sala.id, nombre: 'Sala A' },
          { id: otraSala.id, nombre: 'Sala B' },
        ],
      });
    });

    test('CP-INT-160 una sala ocupada deja de aparecer en los horarios que se traslapan', async () => {
      await insertarCita({ paciente, terapeuta, sala, fecha: LUNES, hora_inicio: '09:00' }); // sala A 09:00–10:00

      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      const salasPorHora = Object.fromEntries(res.body.data.inicios.map((i) => [i.hora_inicio, i.salas_libres.map((s) => s.nombre)]));

      expect(salasPorHora).toEqual({
        '08:00': ['Sala A', 'Sala B'],
        '08:30': ['Sala B'],
        '09:00': ['Sala B'],
        '09:30': ['Sala B'],
        '10:00': ['Sala A', 'Sala B'],
        '10:30': ['Sala A', 'Sala B'],
        '11:00': ['Sala A', 'Sala B'],
      });
    });

    test('CP-INT-160 si no queda ninguna sala libre, el horario desaparece', async () => {
      const otroT = await crearTerapeutaConHorario();
      await insertarCita({ paciente, terapeuta, sala, fecha: LUNES, hora_inicio: '09:00' });
      await insertarCita({ paciente: await crearPaciente(), terapeuta: otroT, sala: otraSala, fecha: LUNES, hora_inicio: '09:00' });

      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      expect(horas(res)).toEqual(['08:00', '10:00', '10:30', '11:00']);
    });

    test('CP-INT-161 excluye los horarios donde el terapeuta ya tiene cita', async () => {
      await insertarCita({ paciente, terapeuta: acotado, sala, fecha: LUNES, hora_inicio: '09:00' });

      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      expect(horas(res)).toEqual(['08:00', '10:00', '10:30', '11:00']);
    });

    test('CP-INT-161 con paciente_id excluye los horarios donde el paciente ya tiene otra cita', async () => {
      const otroT = await crearTerapeutaConHorario();
      await insertarCita({ paciente, terapeuta: otroT, sala, fecha: LUNES, hora_inicio: '10:00' });

      const sinPaciente = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      const conPaciente = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&paciente_id=${paciente.id}`);

      expect(horas(sinPaciente)).toContain('10:00');
      expect(horas(conPaciente)).toEqual(['08:00', '08:30', '09:00', '11:00']);
    });

    test('CP-INT-162 respeta la duración solicitada', async () => {
      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&duracion_slots=4`);

      expect(horas(res)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00']);
      expect(res.body.data.inicios[4]).toMatchObject({ hora_inicio: '10:00', hora_fin: '12:00' });

      const larga = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&duracion_slots=1`);
      expect(larga.body.data.inicios).toHaveLength(8);
    });

    test('CP-INT-162 excluir_cita_id ignora los bloques de la cita que se está editando', async () => {
      const propia = await insertarCita({ paciente, terapeuta: acotado, sala, fecha: LUNES, hora_inicio: '09:00' });

      const sinExcluir = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      const excluyendo = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&excluir_cita_id=${propia.id}`);

      expect(horas(sinExcluir)).toEqual(['08:00', '10:00', '10:30', '11:00']);
      expect(horas(excluyendo)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
    });

    test('CP-INT-163 hoy no ofrece horas que ya pasaron', async () => {
      reloj.fijarAhora(enMerida(LUNES, '09:00'));

      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      expect(horas(res)).toEqual(['09:30', '10:00', '10:30', '11:00']);
    });

    test('CP-INT-163 explica por qué no hay horarios: pasado, fin de semana, sin horario o sin salas', async () => {
      const pasado = await disponibilidad(`fecha=2026-10-15&terapeuta_id=${acotado.id}`);
      expect(pasado.body.data).toMatchObject({ inicios: [], motivo: 'La fecha ya pasó.' });

      const sabado = await disponibilidad(`fecha=2026-10-17&terapeuta_id=${acotado.id}`);
      expect(sabado.body.data.motivo).toBe('La clínica no atiende ese día de la semana.');

      const martes = await disponibilidad(`fecha=${MARTES}&terapeuta_id=${acotado.id}`);
      expect(martes.body.data.motivo).toBe('El terapeuta no tiene horario configurado para ese día.');

      await sala.destroy();
      await otraSala.destroy();
      const sinSalas = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}`);
      expect(sinSalas.body.data.motivo).toBe('No hay salas activas.');
    });

    test('CP-INT-163 valida los parámetros y que el terapeuta exista', async () => {
      expect((await disponibilidad(`fecha=${LUNES}`)).status).toBe(400);
      expect((await disponibilidad(`terapeuta_id=${acotado.id}`)).status).toBe(400);
      expect((await disponibilidad(`fecha=${LUNES}&terapeuta_id=99999`)).status).toBe(404);
      expect((await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&duracion_slots=9`)).status).toBe(400);
    });

    test('CP-INT-164 lo que la disponibilidad ofrece, el alta lo acepta (coherencia)', async () => {
      const res = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&paciente_id=${paciente.id}`);

      for (const inicio of res.body.data.inicios) {
        const alta = await agendar({
          terapeuta_id: acotado.id,
          sala_id: inicio.salas_libres[0].id,
          hora_inicio: inicio.hora_inicio,
        });
        expect([201, 409]).toContain(alta.status);
        if (alta.status === 201) {
          // Tras agendar, ese horario ya no debe ofrecerse.
          const despues = await disponibilidad(`fecha=${LUNES}&terapeuta_id=${acotado.id}&paciente_id=${paciente.id}`);
          expect(horas(despues)).not.toContain(inicio.hora_inicio);
          break;
        }
      }
    });
  });

  describe('reglas que conectan módulos', () => {
    test('CP-INT-170 no se da de baja un paciente o terapeuta con citas pendientes futuras', async () => {
      const creada = (await agendar()).body.data;

      const paciente409 = await request(app).delete(`/api/pacientes/${paciente.id}`).set(bearer(token)).send({ confirmar: true });
      expect(paciente409.status).toBe(409);
      expect(paciente409.body.message).toContain(creada.folio);

      const terapeuta409 = await request(app).delete(`/api/terapeutas/${terapeuta.id}`).set(bearer(token)).send({ confirmar: true });
      expect(terapeuta409.status).toBe(409);
      expect(terapeuta409.body.message).toContain(creada.folio);

      await request(app).post(`/api/citas/${creada.id}/cancelar`).set(bearer(token)).send({ confirmar: true });

      expect((await request(app).delete(`/api/pacientes/${paciente.id}`).set(bearer(token)).send({ confirmar: true })).status).toBe(200);
      expect((await request(app).delete(`/api/terapeutas/${terapeuta.id}`).set(bearer(token)).send({ confirmar: true })).status).toBe(200);
    });

    test('CP-INT-170 el mensaje de baja resume los folios cuando son muchos', async () => {
      for (const hora of ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00']) {
        await agendar({ hora_inicio: hora });
      }

      const res = await request(app).delete(`/api/pacientes/${paciente.id}`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/7 cita\(s\).*y 2 más/);
    });

    test('CP-INT-171 cambiar el horario del terapeuta que deja fuera citas pendientes exige confirmar', async () => {
      const creada = (await agendar()).body.data; // lunes 09:00–10:00
      const nuevoHorario = [{ dia_semana: 1, hora_inicio: '13:00', hora_fin: '17:00' }];

      const advertencia = await request(app)
        .put(`/api/terapeutas/${terapeuta.id}/horarios`)
        .set(bearer(token))
        .send({ horarios: nuevoHorario });

      expect(advertencia.status).toBe(409);
      expect(advertencia.body.folios_afectados).toEqual([creada.folio]);
      expect(await TerapeutaHorario.count({ where: { terapeuta_id: terapeuta.id } })).toBe(5);

      const confirmado = await request(app)
        .put(`/api/terapeutas/${terapeuta.id}/horarios`)
        .set(bearer(token))
        .send({ horarios: nuevoHorario, confirmar_conflictos: true });
      expect(confirmado.status).toBe(200);
      expect(await TerapeutaHorario.count({ where: { terapeuta_id: terapeuta.id } })).toBe(1);
    });

    test('CP-INT-171 un cambio de horario que sigue cubriendo las citas no advierte', async () => {
      await agendar();

      const res = await request(app)
        .put(`/api/terapeutas/${terapeuta.id}/horarios`)
        .set(bearer(token))
        .send({ horarios: [{ dia_semana: 1, hora_inicio: '08:00', hora_fin: '12:00' }] });
      expect(res.status).toBe(200);
    });
  });

  describe('permisos y bitácora', () => {
    test('CP-INT-180 todas las rutas de citas y salas exigen sesión', async () => {
      const rutas = [
        ['get', '/api/citas'],
        ['post', '/api/citas'],
        ['get', '/api/citas/disponibilidad'],
        ['get', '/api/citas/1'],
        ['get', '/api/citas/folio/CIT-2026-000001'],
        ['put', '/api/citas/1'],
        ['post', '/api/citas/1/cancelar'],
        ['post', '/api/citas/folio/CIT-2026-000001/cancelar'],
        ['post', '/api/citas/1/reenviar-confirmacion'],
        ['get', '/api/salas'],
        ['post', '/api/salas'],
        ['get', '/api/salas/disponibilidad'],
        ['get', '/api/salas/1'],
        ['get', '/api/salas/1/disponibilidad'],
        ['delete', '/api/salas/1'],
        ['post', '/api/salas/1/reactivar'],
      ];

      for (const [metodo, ruta] of rutas) {
        const res = await request(app)[metodo](ruta).send({});
        expect({ ruta, estado: res.status }).toEqual({ ruta, estado: 401 });
      }
    });

    test('CP-INT-181 la bitácora registra alta, modificación y cancelación sin datos personales', async () => {
      const creada = (await agendar()).body.data;
      await request(app).put(`/api/citas/${creada.id}`).set(bearer(token)).send({ sala_id: otraSala.id });
      await request(app).get(`/api/citas/${creada.id}`).set(bearer(token));
      await request(app)
        .post(`/api/citas/${creada.id}/cancelar`)
        .set(bearer(token))
        .send({ confirmar: true, motivo: 'Motivo con dato personal: diagnóstico X' });

      const registros = await AuditLog.findAll({ where: { entidad: 'cita' }, order: [['id', 'ASC']] });

      expect(registros.map((r) => r.accion)).toEqual(['crear', 'actualizar', 'consultar', 'cancelar']);
      expect(registros[0].detalle).toEqual({ folio: creada.folio });
      expect(registros[1].detalle).toEqual({ campos: ['sala_id'] });
      expect(registros[3].detalle).toEqual({ con_motivo: true });

      const serializado = JSON.stringify(registros.map((r) => r.toJSON()));
      expect(serializado).not.toContain('diagnóstico');
      expect(serializado).not.toContain('Paciente Número');
    });
  });
});
