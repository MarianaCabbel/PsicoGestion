const request = require('supertest');
const sharp = require('sharp');
const { ConnectionRefusedError } = require('sequelize');
const app = require('../src/app');
const { Terapeuta, TerapeutaFoto, TerapeutaHorario, AuditLog, User } = require('../src/config/database');
const { registrarBajaGuard, limpiarBajaGuards } = require('../src/lib/bajaGuards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { datosTerapeuta, crearImagen, fechaHace } = require('./fixtures');

describe('Módulo de terapeutas', () => {
  useTestDatabase();

  let token;

  beforeEach(async () => {
    token = await loginAs(app);
  });

  afterEach(() => limpiarBajaGuards());

  const crear = (datos = datosTerapeuta(), t = token) =>
    request(app).post('/api/terapeutas').set(bearer(t)).send(datos);

  describe('alta y validaciones', () => {
    test('CP-INT-50 registra un terapeuta válido', async () => {
      const res = await crear();

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        nombre_completo: 'Dr. Luis Alberto Canché Mex',
        correo: 'luis.canche@correo.uady.mx',
        cedula_profesional: '12345678',
        estado: 'activo',
        tiene_foto: false,
      });
    });

    test('CP-INT-50 exige autenticación y rechaza campos ausentes', async () => {
      expect((await request(app).post('/api/terapeutas').send(datosTerapeuta())).status).toBe(401);

      const res = await crear({});
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errors)).toEqual(
        expect.arrayContaining(['nombre_completo', 'telefono', 'correo', 'fecha_nacimiento', 'cedula_profesional'])
      );
    });

    test('CP-INT-51 valida cédula de 7 u 8 dígitos y la normaliza', async () => {
      const corta = await crear(datosTerapeuta({ cedula_profesional: '123456' }));
      expect(corta.status).toBe(400);
      expect(corta.body.errors.cedula_profesional).toBe('La cédula profesional debe tener 7 u 8 dígitos.');

      const letras = await crear(datosTerapeuta({ cedula_profesional: '1234ABC8' }));
      expect(letras.status).toBe(400);

      const conEspacios = await crear(datosTerapeuta({ cedula_profesional: '123 4567' }));
      expect(conEspacios.status).toBe(201);
      expect(conEspacios.body.data.cedula_profesional).toBe('1234567');
    });

    test('CP-INT-51 exige mayoría de edad profesional (21 años)', async () => {
      const res = await crear(datosTerapeuta({ fecha_nacimiento: fechaHace(20) }));

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha_nacimiento).toBe('El terapeuta debe tener al menos 21 años.');
    });

    test('CP-INT-52 correo y cédula duplicados responden 409 por campo', async () => {
      await crear();

      const correo = await crear(datosTerapeuta({ cedula_profesional: '87654321', telefono: '9991111111' }));
      expect(correo.status).toBe(409);
      expect(correo.body.errors.correo).toBe('Ya existe un terapeuta registrado con este correo.');

      const cedula = await crear(datosTerapeuta({ correo: 'otro@correo.uady.mx', telefono: '9992222222' }));
      expect(cedula.status).toBe(409);
      expect(cedula.body.errors.cedula_profesional).toBe(
        'Ya existe un terapeuta registrado con esta cédula profesional.'
      );
    });

    test('CP-INT-52 el correo se compara sin distinguir mayúsculas', async () => {
      await crear();
      const res = await crear(
        datosTerapeuta({
          correo: 'LUIS.CANCHE@CORREO.UADY.MX',
          cedula_profesional: '87654321',
          telefono: '9991111111',
        })
      );
      expect(res.status).toBe(409);
    });

    test('CP-INT-64 rechaza un nombre de más de 50 caracteres (CP2-02)', async () => {
      const res = await crear(datosTerapeuta({ nombre_completo: 'A'.repeat(51) }));

      expect(res.status).toBe(400);
      expect(res.body.errors.nombre_completo).toBe('El nombre completo no puede exceder 50 caracteres.');
    });

    test('CP-INT-64 rechaza una fecha de nacimiento futura (CP2-05)', async () => {
      const res = await crear(datosTerapeuta({ fecha_nacimiento: fechaHace(-1) }));

      expect(res.status).toBe(400);
      expect(res.body.errors.fecha_nacimiento).toBe('La fecha de nacimiento no puede ser futura.');
    });

    test('CP-INT-64 el teléfono duplicado responde 409 por campo (CP2-03)', async () => {
      await crear();

      const res = await crear(datosTerapeuta({ correo: 'otro@correo.uady.mx', cedula_profesional: '87654321' }));

      expect(res.status).toBe(409);
      expect(res.body.errors.telefono).toBe('Ya existe un terapeuta registrado con este teléfono.');
    });
  });

  describe('consulta, actualización y baja', () => {
    test('CP-INT-53 lista con búsqueda y paginación', async () => {
      await crear(datosTerapeuta({ nombre_completo: 'Ana Torres', correo: 'ana@correo.uady.mx', cedula_profesional: '1111111', telefono: '9991111111' }));
      await crear(datosTerapeuta({ nombre_completo: 'Bruno Cab', correo: 'bruno@correo.uady.mx', cedula_profesional: '2222222', telefono: '9992222222' }));
      await crear(datosTerapeuta({ nombre_completo: 'Carlos Dzul', correo: 'carlos@correo.uady.mx', cedula_profesional: '3333333', telefono: '9993333333' }));

      const pagina = await request(app).get('/api/terapeutas?limit=2').set(bearer(token));
      expect(pagina.body.data.total).toBe(3);
      expect(pagina.body.data.items.map((t) => t.nombre_completo)).toEqual(['Ana Torres', 'Bruno Cab']);

      const porCedula = await request(app).get('/api/terapeutas?q=2222222').set(bearer(token));
      expect(porCedula.body.data.items.map((t) => t.nombre_completo)).toEqual(['Bruno Cab']);

      const porCorreo = await request(app).get('/api/terapeutas?q=carlos@').set(bearer(token));
      expect(porCorreo.body.data.items).toHaveLength(1);
    });

    test('CP-INT-54 el perfil incluye horarios y 404 si no existe', async () => {
      const id = (await crear()).body.data.id;

      const perfil = await request(app).get(`/api/terapeutas/${id}`).set(bearer(token));
      expect(perfil.status).toBe(200);
      expect(perfil.body.data.horarios).toEqual([]);

      expect((await request(app).get('/api/terapeutas/9999').set(bearer(token))).status).toBe(404);
    });

    test('CP-INT-55 actualiza datos y respeta la unicidad', async () => {
      const id = (await crear()).body.data.id;
      await crear(datosTerapeuta({ correo: 'otro@correo.uady.mx', cedula_profesional: '7654321', telefono: '9991111111' }));

      const ok = await request(app).put(`/api/terapeutas/${id}`).set(bearer(token)).send({ telefono: '9990000000' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.telefono).toBe('9990000000');

      const mismoCorreo = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ correo: 'luis.canche@correo.uady.mx' });
      expect(mismoCorreo.status).toBe(200);

      const choque = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ correo: 'otro@correo.uady.mx' });
      expect(choque.status).toBe(409);
    });

    test('CP-INT-56 baja lógica con confirmación, bloqueo por regla externa y reactivación por administrador', async () => {
      const id = (await crear()).body.data.id;

      expect((await request(app).delete(`/api/terapeutas/${id}`).set(bearer(token))).status).toBe(400);

      registrarBajaGuard('terapeuta', async () => 'El terapeuta tiene citas pendientes futuras.');
      const bloqueada = await request(app).delete(`/api/terapeutas/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(bloqueada.status).toBe(409);
      expect(bloqueada.body.message).toBe('El terapeuta tiene citas pendientes futuras.');
      limpiarBajaGuards();

      const baja = await request(app).delete(`/api/terapeutas/${id}`).set(bearer(token)).send({ confirmar: true });
      expect(baja.status).toBe(200);
      expect(await Terapeuta.count()).toBe(0);
      expect(await Terapeuta.count({ paranoid: false })).toBe(1);

      const reactivarSecretaria = await request(app).post(`/api/terapeutas/${id}/reactivar`).set(bearer(token));
      expect(reactivarSecretaria.status).toBe(403);

      await User.update({ rol: 'administrador' }, { where: {} });
      const reactivar = await request(app).post(`/api/terapeutas/${id}/reactivar`).set(bearer(token));
      expect(reactivar.status).toBe(200);
      expect(reactivar.body.data.estado).toBe('activo');
    });

    test('CP-INT-56 el correo de un terapeuta dado de baja sigue ocupado', async () => {
      const id = (await crear()).body.data.id;
      await request(app).delete(`/api/terapeutas/${id}`).set(bearer(token)).send({ confirmar: true });

      const res = await crear(datosTerapeuta({ cedula_profesional: '9999999', telefono: '9991111111' }));
      expect(res.status).toBe(409);
      expect(res.body.errors.correo).toMatch(/dado de baja/);
    });

    test('CP-INT-65 el perfil muestra todos los datos del terapeuta (CP2-10)', async () => {
      const id = (await crear()).body.data.id;
      await request(app)
        .put(`/api/terapeutas/${id}/foto`)
        .set(bearer(token))
        .attach('foto', await crearImagen(), { filename: 'foto.png', contentType: 'image/png' });

      const perfil = await request(app).get(`/api/terapeutas/${id}`).set(bearer(token));

      expect(perfil.status).toBe(200);
      expect(perfil.body.data).toMatchObject({
        nombre_completo: 'Dr. Luis Alberto Canché Mex',
        fecha_nacimiento: '1985-06-15',
        cedula_profesional: '12345678',
        telefono: '9997654321',
        correo: 'luis.canche@correo.uady.mx',
        tiene_foto: true,
        estado: 'activo',
      });
      expect(perfil.body.data.edad).toBeGreaterThanOrEqual(41);
      expect(perfil.body.data.horarios).toEqual([]);
    });

    test('CP-INT-65 en edición el teléfono duplicado se rechaza pero el propio se conserva (CP2-12)', async () => {
      const id = (await crear()).body.data.id;
      await crear(
        datosTerapeuta({ correo: 'otro@correo.uady.mx', cedula_profesional: '7654321', telefono: '9991111111' })
      );

      const duplicado = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ telefono: '9991111111' });
      expect(duplicado.status).toBe(409);
      expect(duplicado.body.errors.telefono).toBe('Ya existe un terapeuta registrado con este teléfono.');

      const propio = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ telefono: '9997654321' });
      expect(propio.status).toBe(200);
    });

    test('CP-INT-65 rechaza nombre o fecha inválidos en edición y no guarda (CP2-13)', async () => {
      const id = (await crear()).body.data.id;

      const nombre = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ nombre_completo: 'B'.repeat(51) });
      expect(nombre.status).toBe(400);
      expect(nombre.body.errors.nombre_completo).toBe('El nombre completo no puede exceder 50 caracteres.');

      const fecha = await request(app)
        .put(`/api/terapeutas/${id}`)
        .set(bearer(token))
        .send({ fecha_nacimiento: fechaHace(-1) });
      expect(fecha.status).toBe(400);
      expect(fecha.body.errors.fecha_nacimiento).toBe('La fecha de nacimiento no puede ser futura.');

      const perfil = await request(app).get(`/api/terapeutas/${id}`).set(bearer(token));
      expect(perfil.body.data.nombre_completo).toBe('Dr. Luis Alberto Canché Mex');
      expect(perfil.body.data.fecha_nacimiento).toBe('1985-06-15');
    });

    test('CP-INT-66 un error de conexión al guardar responde 503 y no pierde lo escrito (CP2-15)', async () => {
      const datos = datosTerapeuta({ correo: 'conexion@correo.uady.mx', cedula_profesional: '5555555' });
      const espia = jest
        .spyOn(Terapeuta, 'create')
        .mockRejectedValueOnce(new ConnectionRefusedError(new Error('sin red')));

      const res = await crear(datos);

      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/conexión/);
      expect(await Terapeuta.count()).toBe(0);

      espia.mockRestore();
      const reintento = await crear(datos);
      expect(reintento.status).toBe(201);
    });
  });

  describe('foto', () => {
    let id;

    beforeEach(async () => {
      id = (await crear()).body.data.id;
    });

    const subir = (buffer, nombre = 'foto.png', tipo = 'image/png') =>
      request(app).put(`/api/terapeutas/${id}/foto`).set(bearer(token)).attach('foto', buffer, { filename: nombre, contentType: tipo });

    test('CP-INT-57 acepta una foto válida y la normaliza a WebP 256×256', async () => {
      const res = await subir(await crearImagen({ ancho: 640, alto: 480 }));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ancho: 256, alto: 256, mime: 'image/webp' });

      const guardada = await TerapeutaFoto.findOne({ where: { terapeuta_id: id } });
      const metadatos = await sharp(guardada.data).metadata();
      expect(metadatos.format).toBe('webp');
      expect(metadatos.width).toBe(256);

      const perfil = await request(app).get(`/api/terapeutas/${id}`).set(bearer(token));
      expect(perfil.body.data.tiene_foto).toBe(true);
    });

    test('CP-INT-57 el tamaño mínimo es exactamente 200×200 px', async () => {
      const justa = await subir(await crearImagen({ ancho: 200, alto: 200 }));
      expect(justa.status).toBe(200);

      const chica = await subir(await crearImagen({ ancho: 199, alto: 400 }));
      expect(chica.status).toBe(400);
      expect(chica.body.errors.foto).toBe('La foto debe medir al menos 200×200 píxeles.');
    });

    test('CP-INT-58 no confía en la extensión: un archivo que no es imagen se rechaza', async () => {
      const res = await subir(Buffer.from('esto no es una imagen'), 'foto.png', 'image/png');

      expect(res.status).toBe(400);
      expect(res.body.errors.foto).toBe('El archivo no es una imagen válida.');
    });

    test('CP-INT-58 rechaza formatos no permitidos (GIF)', async () => {
      const gif = await sharp({
        create: { width: 300, height: 300, channels: 3, background: '#fff' },
      })
        .gif()
        .toBuffer();

      const res = await subir(gif, 'foto.gif', 'image/gif');
      expect(res.status).toBe(400);
      expect(res.body.errors.foto).toBe('La foto debe ser JPEG, PNG o WebP.');
    });

    test('CP-INT-58 rechaza archivos de más de 2 MB y peticiones sin archivo', async () => {
      const grande = await subir(Buffer.alloc(2 * 1024 * 1024 + 10, 1));
      expect(grande.status).toBe(400);
      expect(grande.body.errors.foto).toBe('La foto no puede pesar más de 2 MB.');

      const sinArchivo = await request(app).put(`/api/terapeutas/${id}/foto`).set(bearer(token));
      expect(sinArchivo.status).toBe(400);
    });

    test('CP-INT-59 sirve la foto autenticada y reemplaza la anterior sin duplicar filas', async () => {
      expect((await request(app).get(`/api/terapeutas/${id}/foto`).set(bearer(token))).status).toBe(404);

      await subir(await crearImagen());
      await subir(await crearImagen({ formato: 'jpeg' }));
      expect(await TerapeutaFoto.count()).toBe(1);

      const res = await request(app).get(`/api/terapeutas/${id}/foto`).set(bearer(token)).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['cache-control']).toBe('private, max-age=300');

      const sinSesion = await request(app).get(`/api/terapeutas/${id}/foto`);
      expect(sinSesion.status).toBe(401);
    });

    test('CP-INT-59 la foto no viaja en el listado, solo la bandera tiene_foto', async () => {
      await subir(await crearImagen());

      const res = await request(app).get('/api/terapeutas').set(bearer(token));
      const [item] = res.body.data.items;

      expect(item.tiene_foto).toBe(true);
      expect(item).not.toHaveProperty('foto');
      expect(item).not.toHaveProperty('data');
      expect(JSON.stringify(res.body).length).toBeLessThan(1000);
    });
  });

  describe('horarios', () => {
    let id;

    beforeEach(async () => {
      id = (await crear()).body.data.id;
    });

    const guardar = (horarios) =>
      request(app).put(`/api/terapeutas/${id}/horarios`).set(bearer(token)).send({ horarios });

    test('CP-INT-60 reemplaza el horario semanal completo y lo devuelve ordenado', async () => {
      const res = await guardar([
        { dia_semana: 3, hora_inicio: '09:00', hora_fin: '13:00' },
        { dia_semana: 1, hora_inicio: '15:00', hora_fin: '19:00' },
        { dia_semana: 1, hora_inicio: '07:00', hora_fin: '11:30' },
      ]);

      expect(res.status).toBe(200);
      expect(res.body.data.horarios).toEqual([
        { dia_semana: 1, hora_inicio: '07:00', hora_fin: '11:30' },
        { dia_semana: 1, hora_inicio: '15:00', hora_fin: '19:00' },
        { dia_semana: 3, hora_inicio: '09:00', hora_fin: '13:00' },
      ]);

      const segunda = await guardar([{ dia_semana: 2, hora_inicio: '08:00', hora_fin: '10:00' }]);
      expect(segunda.status).toBe(200);
      expect(await TerapeutaHorario.count({ where: { terapeuta_id: id } })).toBe(1);

      const lectura = await request(app).get(`/api/terapeutas/${id}/horarios`).set(bearer(token));
      expect(lectura.body.data.horarios).toHaveLength(1);
    });

    test('CP-INT-61 enviar una lista vacía limpia el horario', async () => {
      await guardar([{ dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }]);
      const res = await guardar([]);

      expect(res.status).toBe(200);
      expect(res.body.data.horarios).toEqual([]);
    });

    test.each([
      ['traslape en el mismo día', [
        { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: 1, hora_inicio: '09:30', hora_fin: '11:00' },
      ], 'horarios.1.hora_inicio', 'Las franjas de un mismo día no pueden traslaparse.'],
      ['hora fuera de la ventana de atención', [
        { dia_semana: 1, hora_inicio: '06:30', hora_fin: '08:00' },
      ], 'horarios.0.hora_inicio', 'El horario de atención inicia a las 07:00.'],
      ['hora de fin posterior al cierre', [
        { dia_semana: 1, hora_inicio: '18:00', hora_fin: '19:30' },
      ], 'horarios.0.hora_fin', 'El horario de atención termina a las 19:00.'],
      ['minutos que no son múltiplos de 30', [
        { dia_semana: 1, hora_inicio: '08:10', hora_fin: '09:00' },
      ], 'horarios.0.hora_inicio', 'La hora de inicio debe ser múltiplo de 30 minutos.'],
      ['fin anterior al inicio', [
        { dia_semana: 1, hora_inicio: '10:00', hora_fin: '09:00' },
      ], 'horarios.0.hora_fin', 'La hora de fin debe ser posterior a la hora de inicio.'],
      ['día que no es de atención (domingo)', [
        { dia_semana: 7, hora_inicio: '08:00', hora_fin: '09:00' },
      ], 'horarios.0.dia_semana', 'El día seleccionado no es un día de atención.'],
      ['formato de hora inválido', [
        { dia_semana: 1, hora_inicio: '8am', hora_fin: '09:00' },
      ], 'horarios.0.hora_inicio', 'La hora de inicio debe tener el formato HH:mm.'],
    ])('CP-INT-61 rechaza %s', async (_nombre, horarios, campo, mensaje) => {
      const res = await guardar(horarios);

      expect(res.status).toBe(400);
      expect(res.body.errors[campo]).toBe(mensaje);
    });

    test('CP-INT-61 franjas contiguas en el mismo día sí se permiten', async () => {
      const res = await guardar([
        { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: 1, hora_inicio: '10:00', hora_fin: '12:00' },
      ]);

      expect(res.status).toBe(200);
    });

    test('CP-INT-62 un error de validación no borra el horario existente (todo o nada)', async () => {
      await guardar([{ dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }]);
      await guardar([{ dia_semana: 1, hora_inicio: '10:00', hora_fin: '09:00' }]);

      expect(await TerapeutaHorario.count({ where: { terapeuta_id: id } })).toBe(1);
    });
  });

  test('CP-INT-63 la bitácora registra las operaciones sin datos personales', async () => {
    const id = (await crear()).body.data.id;
    await request(app).put(`/api/terapeutas/${id}`).set(bearer(token)).send({ telefono: '9990000000' });
    await request(app)
      .put(`/api/terapeutas/${id}/horarios`)
      .set(bearer(token))
      .send({ horarios: [{ dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }] });

    const registros = await AuditLog.findAll({ where: { entidad: 'terapeuta' }, order: [['id', 'ASC']] });

    expect(registros.map((r) => r.accion)).toEqual(['crear', 'actualizar', 'actualizar']);
    expect(registros[2].detalle).toEqual({ campos: ['horarios'], franjas: 1 });

    const serializado = JSON.stringify(registros.map((r) => r.toJSON()));
    expect(serializado).not.toContain('9990000000');
    expect(serializado).not.toContain('luis.canche');
  });
});
