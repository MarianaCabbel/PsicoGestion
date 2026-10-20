const request = require('supertest');
const app = require('../src/app');
const { Paciente, AuditLog } = require('../src/config/database');
const { registrarBajaGuard, limpiarBajaGuards } = require('../src/lib/bajaGuards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { crearCurp, datosPaciente, fechaHace } = require('./fixtures');

describe('Módulo de pacientes', () => {
  useTestDatabase();

  let token;

  beforeEach(async () => {
    token = await loginAs(app);
  });

  afterEach(() => limpiarBajaGuards());

  const crear = (datos = datosPaciente(), t = token) =>
    request(app).post('/api/pacientes').set(bearer(t)).send(datos);

  describe('alta', () => {
    test('CP-INT-30 registra un paciente válido y devuelve 201 con edad calculada', async () => {
      const res = await crear();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        nombre_completo: 'María José Hernández Pérez',
        sexo: 'H',
        telefono: '9991234567',
        estado: 'activo',
        correo: null,
      });
      expect(res.body.data.edad).toBeGreaterThanOrEqual(36);
      expect(res.body.data.id).toBeTruthy();
    });

    test('CP-INT-30 normaliza CURP en minúsculas, espacios del nombre y separadores del teléfono', async () => {
      const datos = datosPaciente({
        nombre_completo: '  Ana   María  López ',
        curp: crearCurp().toLowerCase(),
        telefono: '(999) 123-4567',
        correo: '  ANA@Correo.com ',
      });

      const res = await crear(datos);

      expect(res.status).toBe(201);
      expect(res.body.data.nombre_completo).toBe('Ana María López');
      expect(res.body.data.curp).toBe(crearCurp());
      expect(res.body.data.telefono).toBe('9991234567');
      expect(res.body.data.correo).toBe('ana@correo.com');
    });

    test('CP-INT-31 exige autenticación', async () => {
      const res = await request(app).post('/api/pacientes').send(datosPaciente());
      expect(res.status).toBe(401);
    });

    test('CP-INT-31 rechaza campos obligatorios ausentes con errores por campo', async () => {
      const res = await crear({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(Object.keys(res.body.errors)).toEqual(
        expect.arrayContaining(['nombre_completo', 'curp', 'sexo', 'fecha_nacimiento', 'telefono'])
      );
    });

    test('CP-INT-32 rechaza una CURP con dígito verificador incorrecto', async () => {
      const curp = crearCurp();
      const res = await crear(datosPaciente({ curp: `${curp.slice(0, 17)}${(Number(curp[17]) + 1) % 10}` }));

      expect(res.status).toBe(400);
      expect(res.body.errors.curp).toBe('El dígito verificador de la CURP no es correcto.');
    });

    test('CP-INT-32 rechaza fecha o sexo que contradicen la CURP', async () => {
      const res = await crear(datosPaciente({ fecha_nacimiento: '1991-04-27', sexo: 'M', curp: crearCurp() }));

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha_nacimiento).toBe('La fecha de nacimiento no coincide con la CURP.');
      expect(res.body.errors.sexo).toBe('El sexo no coincide con la CURP.');
    });

    test('CP-INT-33 aplica la edad mínima de 7 años (límite exacto permitido)', async () => {
      const seis = fechaHace(7, -1); // cumple 7 mañana: aún tiene 6
      const siete = fechaHace(7);

      const rechazado = await crear(
        datosPaciente({ fecha_nacimiento: seis, curp: crearCurp({ fecha: seis, semilla: 1 }) })
      );
      expect(rechazado.status).toBe(400);
      expect(rechazado.body.errors.fecha_nacimiento).toBe('La edad mínima del paciente es de 7 años.');

      const aceptado = await crear(
        datosPaciente({ fecha_nacimiento: siete, curp: crearCurp({ fecha: siete, semilla: 2 }) })
      );
      expect(aceptado.status).toBe(201);
    });

    test.each([
      ['inicio del día en Mérida', '2026-10-17T06:00:00Z'],
      ['mediodía', '2026-10-17T18:00:00Z'],
      ['noche (ya es el día siguiente en UTC)', '2026-10-18T03:00:00Z'],
      ['un minuto antes de medianoche', '2026-10-18T05:59:00Z'],
    ])('CP-INT-33 la frontera de 7 años no depende de la hora del día: %s', async (_nombre, instante) => {
      const reloj = require('../src/lib/reloj');
      reloj.fijarAhora(new Date(instante));

      const cumple7 = fechaHace(7);
      const cumpleManana = fechaHace(7, -1);
      const semilla = Number(instante.slice(11, 13)) + 40;

      const aceptado = await crear(
        datosPaciente({ fecha_nacimiento: cumple7, curp: crearCurp({ fecha: cumple7, semilla }) })
      );
      expect(aceptado.status).toBe(201);

      const rechazado = await crear(
        datosPaciente({ fecha_nacimiento: cumpleManana, curp: crearCurp({ fecha: cumpleManana, semilla: semilla + 1 }) })
      );
      expect(rechazado.status).toBe(400);
    });

    test('CP-INT-33 rechaza una fecha de nacimiento futura', async () => {
      const futura = fechaHace(-1);
      const res = await crear(datosPaciente({ fecha_nacimiento: futura, curp: crearCurp({ fecha: futura }) }));

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha_nacimiento).toBe('La fecha de nacimiento no puede ser futura.');
    });

    test('CP-INT-34 rechaza teléfono que no tiene 10 dígitos', async () => {
      const res = await crear(datosPaciente({ telefono: '12345' }));

      expect(res.status).toBe(400);
      expect(res.body.errors.telefono).toBe('El teléfono debe tener 10 dígitos.');
    });

    test('CP-INT-34 rechaza nombres con símbolos y correos inválidos', async () => {
      const nombre = await crear(datosPaciente({ nombre_completo: 'Ana <script>' }));
      expect(nombre.status).toBe(400);
      expect(nombre.body.errors.nombre_completo).toMatch(/solo puede contener letras/);

      const correo = await crear(datosPaciente({ correo: 'no-es-correo' }));
      expect(correo.status).toBe(400);
      expect(correo.body.errors.correo).toBe('El correo electrónico no es válido.');
    });

    test('CP-INT-35 responde 409 si la CURP ya existe', async () => {
      await crear();
      const res = await crear(datosPaciente({ nombre_completo: 'Otra Persona' }));

      expect(res.status).toBe(409);
      expect(res.body.errors.curp).toBe('Ya existe un paciente registrado con esta CURP.');
    });

    test('CP-INT-35 permite teléfonos repetidos (una familia puede compartir línea)', async () => {
      await crear(datosPaciente({ semilla: 3 }));
      const res = await crear(datosPaciente({ semilla: 4 }));

      expect(res.status).toBe(201);
    });
  });

  describe('consulta', () => {
    beforeEach(async () => {
      await crear(datosPaciente({ nombre_completo: 'Ana Pérez', semilla: 1 }));
      await crear(datosPaciente({ nombre_completo: 'Bruno Díaz', semilla: 2, telefono: '9998887766' }));
      await crear(datosPaciente({ nombre_completo: 'Carla Ruiz', semilla: 3 }));
    });

    test('CP-INT-36 lista ordenada por nombre con paginación', async () => {
      const res = await request(app).get('/api/pacientes?limit=2&page=1').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.total_paginas).toBe(2);
      expect(res.body.data.items.map((p) => p.nombre_completo)).toEqual(['Ana Pérez', 'Bruno Díaz']);

      const segunda = await request(app).get('/api/pacientes?limit=2&page=2').set(bearer(token));
      expect(segunda.body.data.items.map((p) => p.nombre_completo)).toEqual(['Carla Ruiz']);
    });

    test('CP-INT-36 busca por nombre, teléfono y CURP', async () => {
      const porNombre = await request(app).get('/api/pacientes?q=bruno').set(bearer(token));
      expect(porNombre.body.data.items).toHaveLength(1);

      const porTelefono = await request(app).get('/api/pacientes?q=888-7766').set(bearer(token));
      expect(porTelefono.body.data.items.map((p) => p.nombre_completo)).toEqual(['Bruno Díaz']);

      const porCurp = await request(app)
        .get(`/api/pacientes?q=${crearCurp({ semilla: 3 }).toLowerCase()}`)
        .set(bearer(token));
      expect(porCurp.body.data.items.map((p) => p.nombre_completo)).toEqual(['Carla Ruiz']);
    });

    test('CP-INT-36 los comodines del usuario no alteran la búsqueda', async () => {
      const res = await request(app).get('/api/pacientes?q=%25').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(3);
    });

    test('CP-INT-37 rechaza parámetros de listado inválidos', async () => {
      const res = await request(app).get('/api/pacientes?limit=500&page=0').set(bearer(token));

      expect(res.status).toBe(400);
      expect(res.body.errors.limit).toBeTruthy();
      expect(res.body.errors.page).toBeTruthy();
    });

    test('CP-INT-37 obtiene el perfil y devuelve 404 si no existe', async () => {
      const lista = await request(app).get('/api/pacientes').set(bearer(token));
      const id = lista.body.data.items[0].id;

      const perfil = await request(app).get(`/api/pacientes/${id}`).set(bearer(token));
      expect(perfil.status).toBe(200);
      expect(perfil.body.data.nombre_completo).toBe('Ana Pérez');

      const inexistente = await request(app).get('/api/pacientes/99999').set(bearer(token));
      expect(inexistente.status).toBe(404);

      const invalido = await request(app).get('/api/pacientes/abc').set(bearer(token));
      expect(invalido.status).toBe(400);
    });
  });

  describe('actualización', () => {
    let id;

    beforeEach(async () => {
      id = (await crear()).body.data.id;
    });

    test('CP-INT-38 actualiza solo los campos enviados', async () => {
      const res = await request(app)
        .put(`/api/pacientes/${id}`)
        .set(bearer(token))
        .send({ telefono: '9990001111', correo: 'nuevo@correo.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.telefono).toBe('9990001111');
      expect(res.body.data.correo).toBe('nuevo@correo.com');
      expect(res.body.data.nombre_completo).toBe('María José Hernández Pérez');
    });

    test('CP-INT-38 rechaza un cuerpo vacío', async () => {
      const res = await request(app).put(`/api/pacientes/${id}`).set(bearer(token)).send({});
      expect(res.status).toBe(400);
    });

    test('CP-INT-39 cambiar la fecha sin cambiar la CURP se rechaza por inconsistencia', async () => {
      const res = await request(app)
        .put(`/api/pacientes/${id}`)
        .set(bearer(token))
        .send({ fecha_nacimiento: '1992-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha_nacimiento).toBe('La fecha de nacimiento no coincide con la CURP.');
    });

    test('CP-INT-39 cambiar la CURP junto con fecha y sexo coherentes funciona; duplicarla da 409', async () => {
      const otro = (await crear(datosPaciente({ semilla: 9 }))).body.data;

      const nueva = crearCurp({ semilla: 20 });
      const ok = await request(app)
        .put(`/api/pacientes/${id}`)
        .set(bearer(token))
        .send({ curp: nueva });
      expect(ok.status).toBe(200);
      expect(ok.body.data.curp).toBe(nueva);

      const duplicada = await request(app)
        .put(`/api/pacientes/${id}`)
        .set(bearer(token))
        .send({ curp: otro.curp });
      expect(duplicada.status).toBe(409);
    });

    test('CP-INT-39 no permite editar un paciente dado de baja', async () => {
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      const res = await request(app).put(`/api/pacientes/${id}`).set(bearer(token)).send({ telefono: '9990001111' });
      expect(res.status).toBe(409);
    });
  });

  describe('baja lógica y reactivación', () => {
    let id;

    beforeEach(async () => {
      id = (await crear()).body.data.id;
    });

    test('CP-INT-40 exige confirmación explícita para dar de baja', async () => {
      const sinCuerpo = await request(app).delete(`/api/pacientes/${id}`).set(bearer(token));
      expect(sinCuerpo.status).toBe(400);

      const falso = await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: false });
      expect(falso.status).toBe(400);

      expect(await Paciente.count()).toBe(1);
    });

    test('CP-INT-40 la baja es lógica: el registro se conserva y sale del listado activo', async () => {
      const res = await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(200);

      expect(await Paciente.count()).toBe(0);
      expect(await Paciente.count({ paranoid: false })).toBe(1);

      const activos = await request(app).get('/api/pacientes').set(bearer(token));
      expect(activos.body.data.total).toBe(0);

      const bajas = await request(app).get('/api/pacientes?estado=baja').set(bearer(token));
      expect(bajas.body.data.items).toHaveLength(1);
      expect(bajas.body.data.items[0].estado).toBe('baja');

      const perfil = await request(app).get(`/api/pacientes/${id}`).set(bearer(token));
      expect(perfil.body.data.estado).toBe('baja');
    });

    test('CP-INT-41 la CURP de un paciente dado de baja no se puede registrar de nuevo', async () => {
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      const res = await crear();
      expect(res.status).toBe(409);
      expect(res.body.errors.curp).toMatch(/dado de baja/);
    });

    test('CP-INT-41 una baja ya aplicada devuelve 409', async () => {
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });
      const res = await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(res.status).toBe(409);
    });

    test('CP-INT-42 una regla de baja registrada por otro módulo puede bloquearla (citas futuras)', async () => {
      registrarBajaGuard('paciente', async () => 'El paciente tiene citas pendientes futuras.');

      const res = await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('El paciente tiene citas pendientes futuras.');
      expect(await Paciente.count()).toBe(1);
    });

    test('CP-INT-43 solo un administrador puede reactivar', async () => {
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      const secretaria = await request(app).post(`/api/pacientes/${id}/reactivar`).set(bearer(token));
      expect(secretaria.status).toBe(403);
    });
  });

  describe('roles y consentimiento', () => {
    test('CP-INT-43 un administrador reactiva al paciente', async () => {
      const { User } = require('../src/config/database');
      const id = (await crear()).body.data.id;
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      await User.update({ rol: 'administrador' }, { where: {} });

      const res = await request(app).post(`/api/pacientes/${id}/reactivar`).set(bearer(token));
      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('activo');

      const otraVez = await request(app).post(`/api/pacientes/${id}/reactivar`).set(bearer(token));
      expect(otraVez.status).toBe(409);
    });

    test('CP-INT-44 registra el consentimiento con la versión del aviso de privacidad', async () => {
      const id = (await crear()).body.data.id;

      const sinAceptar = await request(app)
        .post(`/api/pacientes/${id}/consentimiento`)
        .set(bearer(token))
        .send({ aceptado: false });
      expect(sinAceptar.status).toBe(400);

      const res = await request(app)
        .post(`/api/pacientes/${id}/consentimiento`)
        .set(bearer(token))
        .send({ aceptado: true });

      expect(res.status).toBe(200);
      expect(res.body.data.aviso_version).toBe('v1.0');
      expect(res.body.data.consentimiento_at).toBeTruthy();
    });
  });

  describe('bitácora de auditoría', () => {
    test('CP-INT-45 registra alta, consulta, actualización y baja sin guardar datos personales', async () => {
      const id = (await crear()).body.data.id;
      await request(app).get(`/api/pacientes/${id}`).set(bearer(token));
      await request(app).put(`/api/pacientes/${id}`).set(bearer(token)).send({ telefono: '9990001111' });
      await request(app).delete(`/api/pacientes/${id}`).set(bearer(token)).send({ confirmar: true });

      const registros = await AuditLog.findAll({ where: { entidad: 'paciente' }, order: [['id', 'ASC']] });

      expect(registros.map((r) => r.accion)).toEqual(['crear', 'consultar', 'actualizar', 'baja']);
      expect(registros.every((r) => r.usuario_id && r.entidad_id === id)).toBe(true);
      expect(registros[2].detalle).toEqual({ campos: ['telefono'] });

      const serializado = JSON.stringify(registros.map((r) => r.toJSON()));
      expect(serializado).not.toContain('9990001111');
      expect(serializado).not.toContain('María');
    });
  });
});
