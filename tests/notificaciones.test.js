const request = require('supertest');
const app = require('../src/app');
const { Notificacion, sequelize } = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { testOutbox, testControl, construirCorreoDeCita } = require('../src/utils/email');
const notificaciones = require('../src/modules/citas/notificaciones.service');
const { iniciarWorkerDeNotificaciones } = require('../src/jobs/notificacionesWorker');
const { registrarGuardsDeCitas } = require('../src/modules/citas/citas.guards');
const { useTestDatabase, loginAs, bearer } = require('./helpers');
const { crearPaciente, crearTerapeutaConHorario, crearSala, insertarCita, enMerida } = require('./fixtures');

const LUNES = '2026-10-19';

describe('Notificaciones por correo (bandeja de salida)', () => {
  useTestDatabase();

  let token;
  let paciente;
  let terapeuta;
  let sala;

  beforeEach(async () => {
    registrarGuardsDeCitas();
    reloj.fijarAhora(enMerida('2026-10-16', '08:00'));
    token = await loginAs(app);
    paciente = await crearPaciente({ nombre_completo: 'Ana López', correo: 'ana@correo.com' });
    terapeuta = await crearTerapeutaConHorario({ nombre_completo: 'Dr. Luis Canché' });
    sala = await crearSala('Sala A');
  });

  const agendar = (extra = {}) =>
    request(app)
      .post('/api/citas')
      .set(bearer(token))
      .send({
        paciente_id: paciente.id,
        terapeuta_id: terapeuta.id,
        sala_id: sala.id,
        fecha: LUNES,
        hora_inicio: '09:00',
        ...extra,
      });

  describe('alta de la notificación', () => {
    test('CP-INT-190 agendar encola la confirmación sin enviar el correo dentro de la petición', async () => {
      const res = await agendar();

      expect(res.status).toBe(201);
      const aviso = await Notificacion.findOne();
      expect(aviso).toMatchObject({
        tipo: 'confirmacion',
        cita_id: res.body.data.id,
        destinatario: 'ana@correo.com',
        estado: 'pendiente',
        intentos: 0,
      });
      expect(testOutbox).toHaveLength(0);
    });

    test('CP-INT-190 un paciente sin correo no genera notificación y la cita se agenda igual', async () => {
      await paciente.update({ correo: null });

      const res = await agendar();
      expect(res.status).toBe(201);
      expect(res.body.data.paciente_tiene_correo).toBe(false);
      expect(res.body.data.notificacion).toBeNull();
      expect(await Notificacion.count()).toBe(0);
    });

    test('CP-INT-191 una caída del SMTP no impide agendar la cita', async () => {
      testControl.fallar = true;

      const res = await agendar();
      expect(res.status).toBe(201);
    });
  });

  describe('envío', () => {
    test('CP-INT-192 el worker envía la confirmación con los datos de la cita', async () => {
      const cita = (await agendar()).body.data;

      const resumen = await notificaciones.procesarPendientes();

      expect(resumen).toEqual({ enviadas: 1, reintentos: 0, fallidas: 0, omitidas: 0 });
      expect(testOutbox).toHaveLength(1);
      expect(testOutbox[0]).toMatchObject({
        tipo: 'cita:confirmacion',
        to: 'ana@correo.com',
        cita: {
          folio: cita.folio,
          fecha_larga: 'lunes, 19 de octubre de 2026',
          hora_inicio: '09:00',
          hora_fin: '10:00',
          paciente_nombre: 'Ana López',
          terapeuta_nombre: 'Dr. Luis Canché',
          sala_nombre: 'Sala A',
        },
      });

      const aviso = await Notificacion.findOne();
      expect(aviso).toMatchObject({ estado: 'enviada', intentos: 1, ultimo_error: null });
      expect(aviso.enviada_at).toBeTruthy();
    });

    test('CP-INT-192 una notificación enviada no se vuelve a enviar', async () => {
      await agendar();
      await notificaciones.procesarPendientes();
      const segunda = await notificaciones.procesarPendientes();

      expect(segunda).toEqual({ enviadas: 0, reintentos: 0, fallidas: 0, omitidas: 0 });
      expect(testOutbox).toHaveLength(1);
    });

    test('CP-INT-192 el detalle de la cita refleja el estado del correo', async () => {
      const cita = (await agendar()).body.data;
      await notificaciones.procesarPendientes();

      const res = await request(app).get(`/api/citas/${cita.id}`).set(bearer(token));
      expect(res.body.data.notificacion).toMatchObject({ estado: 'enviada', intentos: 1 });
    });

    test('CP-INT-193 modificar y cancelar generan sus propios avisos', async () => {
      const cita = (await agendar()).body.data;
      await notificaciones.procesarPendientes();

      await request(app).put(`/api/citas/${cita.id}`).set(bearer(token)).send({ hora_inicio: '11:00' });
      await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true, motivo: 'Cambio de planes' });
      await notificaciones.procesarPendientes();

      // La modificación quedó pendiente y se cancela después: ya no tiene sentido avisarla.
      const tipos = testOutbox.map((envio) => envio.tipo);
      expect(tipos).toEqual(['cita:confirmacion', 'cita:cancelacion']);

      const estados = Object.fromEntries((await Notificacion.findAll()).map((n) => [n.tipo, n.estado]));
      expect(estados).toEqual({ confirmacion: 'enviada', modificacion: 'omitida', cancelacion: 'enviada' });
      expect(testOutbox[1].cita.motivo_cancelacion).toBe('Cambio de planes');
    });

    test('CP-INT-193 una confirmación pendiente de una cita ya cancelada se omite', async () => {
      const cita = (await agendar()).body.data;
      await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });

      const resumen = await notificaciones.procesarPendientes();

      expect(resumen).toMatchObject({ enviadas: 1, omitidas: 1 });
      expect(testOutbox.map((e) => e.tipo)).toEqual(['cita:cancelacion']);
    });

    test('CP-INT-194 dos workers simultáneos no envían el mismo correo dos veces', async () => {
      await agendar();

      await Promise.all([notificaciones.procesarPendientes(), notificaciones.procesarPendientes()]);

      expect(testOutbox).toHaveLength(1);
      expect(await Notificacion.count({ where: { estado: 'enviada' } })).toBe(1);
    });
  });

  describe('reintentos', () => {
    test('CP-INT-195 si el SMTP falla, reprograma con espera de 1 minuto y guarda el error', async () => {
      await agendar();
      testControl.fallar = true;

      const resumen = await notificaciones.procesarPendientes();
      expect(resumen.reintentos).toBe(1);

      const aviso = await Notificacion.findOne();
      expect(aviso).toMatchObject({ estado: 'pendiente', intentos: 1, ultimo_error: 'SMTP no disponible (simulado)' });
      expect(aviso.proximo_intento_at.getTime() - reloj.ahora().getTime()).toBe(60 * 1000);

      // Antes de cumplirse la espera no se vuelve a intentar.
      expect(await notificaciones.procesarPendientes()).toEqual({ enviadas: 0, reintentos: 0, fallidas: 0, omitidas: 0 });
    });

    test('CP-INT-195 al restablecerse el SMTP el siguiente intento lo envía', async () => {
      await agendar();
      testControl.fallar = true;
      await notificaciones.procesarPendientes();

      testControl.fallar = false;
      reloj.fijarAhora(new Date(reloj.ahora().getTime() + 61 * 1000));
      const resumen = await notificaciones.procesarPendientes();

      expect(resumen.enviadas).toBe(1);
      expect(await Notificacion.findOne()).toMatchObject({ estado: 'enviada', intentos: 2, ultimo_error: null });
    });

    test('CP-INT-196 tras 5 intentos fallidos queda como "fallida" con espera creciente 1, 5, 15 y 60 min', async () => {
      await agendar();
      testControl.fallar = true;

      const esperas = [];
      for (let intento = 1; intento <= 5; intento += 1) {
        const resumen = await notificaciones.procesarPendientes();
        expect(resumen).toMatchObject(intento < 5 ? { reintentos: 1 } : { fallidas: 1 });

        const aviso = await Notificacion.findOne();
        if (intento < 5) {
          esperas.push((aviso.proximo_intento_at.getTime() - reloj.ahora().getTime()) / 60000);
          reloj.fijarAhora(aviso.proximo_intento_at);
        }
      }

      expect(esperas).toEqual([1, 5, 15, 60]);
      expect(await Notificacion.findOne()).toMatchObject({ estado: 'fallida', intentos: 5 });
      expect(await notificaciones.procesarPendientes()).toEqual({ enviadas: 0, reintentos: 0, fallidas: 0, omitidas: 0 });
    });

    test('CP-INT-197 el error guardado no conserva direcciones de correo', async () => {
      await agendar();
      testControl.fallar = true;
      testControl.mensaje = '550 5.1.1 <ana@correo.com>: user unknown';

      await notificaciones.procesarPendientes();

      const aviso = await Notificacion.findOne();
      expect(aviso.ultimo_error).toBe('550 5.1.1 <[correo]>: user unknown');
      expect(aviso.ultimo_error).not.toContain('ana@');
    });

    test('CP-INT-198 una notificación que quedó "procesando" demasiado tiempo se recupera', async () => {
      await agendar();
      const aviso = await Notificacion.findOne();
      await sequelize.query("UPDATE notificaciones SET estado = 'procesando', updated_at = :antes WHERE id = :id", {
        replacements: { antes: new Date(reloj.ahora().getTime() - 11 * 60 * 1000), id: aviso.id },
      });

      const resumen = await notificaciones.procesarPendientes();
      expect(resumen.enviadas).toBe(1);
    });

    test('CP-INT-198 una "procesando" reciente no se toca (otro proceso la está enviando)', async () => {
      await agendar();
      const aviso = await Notificacion.findOne();
      await aviso.update({ estado: 'procesando' });

      expect(await notificaciones.procesarPendientes()).toEqual({ enviadas: 0, reintentos: 0, fallidas: 0, omitidas: 0 });
      expect(testOutbox).toHaveLength(0);
    });
  });

  describe('reenviar confirmación', () => {
    test('CP-INT-200 reencola la confirmación de una cita pendiente', async () => {
      const cita = (await agendar()).body.data;
      await notificaciones.procesarPendientes();

      const res = await request(app).post(`/api/citas/${cita.id}/reenviar-confirmacion`).set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.data.notificacion.estado).toBe('pendiente');
      await notificaciones.procesarPendientes();
      expect(testOutbox.map((e) => e.tipo)).toEqual(['cita:confirmacion', 'cita:confirmacion']);
    });

    test('CP-INT-200 no aplica a citas canceladas, vencidas ni a pacientes sin correo', async () => {
      const cita = (await agendar()).body.data;

      await paciente.update({ correo: null });
      const sinCorreo = await request(app).post(`/api/citas/${cita.id}/reenviar-confirmacion`).set(bearer(token));
      expect(sinCorreo.status).toBe(409);
      expect(sinCorreo.body.message).toBe('El paciente no tiene correo registrado.');
      await paciente.update({ correo: 'ana@correo.com' });

      const vencida = await insertarCita({ paciente, terapeuta, sala, fecha: '2026-10-14' });
      expect((await request(app).post(`/api/citas/${vencida.id}/reenviar-confirmacion`).set(bearer(token))).status).toBe(409);

      await request(app).post(`/api/citas/${cita.id}/cancelar`).set(bearer(token)).send({ confirmar: true });
      const cancelada = await request(app).post(`/api/citas/${cita.id}/reenviar-confirmacion`).set(bearer(token));
      expect(cancelada.status).toBe(409);
      expect(cancelada.body.message).toBe('Solo se puede reenviar la confirmación de una cita pendiente.');

      expect((await request(app).post('/api/citas/99999/reenviar-confirmacion').set(bearer(token))).status).toBe(404);
    });
  });

  describe('contenido del correo', () => {
    const cita = {
      folio: 'CIT-2026-000001',
      fecha_larga: 'lunes, 19 de octubre de 2026',
      hora_inicio: '09:00',
      hora_fin: '10:00',
      paciente_nombre: 'Ana López',
      terapeuta_nombre: 'Dr. Luis Canché',
      sala_nombre: 'Sala A',
      motivo_cancelacion: null,
    };

    test('CP-UNI-48 incluye folio, paciente, fecha, horario, terapeuta y sala', () => {
      const { subject, html } = construirCorreoDeCita({ tipo: 'confirmacion', cita });

      expect(subject).toBe('Confirmación de cita - PsicoGestión');
      ['CIT-2026-000001', 'Ana López', 'lunes, 19 de octubre de 2026', '09:00 a 10:00', 'Dr. Luis Canché', 'Sala A'].forEach(
        (dato) => expect(html).toContain(dato)
      );
    });

    test('CP-UNI-48 escapa los datos variables para evitar inyección de HTML', () => {
      const { html } = construirCorreoDeCita({
        tipo: 'cancelacion',
        cita: { ...cita, paciente_nombre: '<script>alert(1)</script>', terapeuta_nombre: 'A & B', motivo_cancelacion: '<img src=x onerror=a()>' },
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).toContain('A &amp; B');
      expect(html).toContain('Motivo: &lt;img');
    });

    test('CP-UNI-48 el motivo solo aparece en las cancelaciones', () => {
      const conMotivo = { ...cita, motivo_cancelacion: 'Cambio de planes' };

      expect(construirCorreoDeCita({ tipo: 'cancelacion', cita: conMotivo }).html).toContain('Cambio de planes');
      expect(construirCorreoDeCita({ tipo: 'confirmacion', cita: conMotivo }).html).not.toContain('Cambio de planes');
    });
  });

  describe('worker periódico', () => {
    test('CP-INT-201 envía los pendientes en cada intervalo y se detiene', async () => {
      await agendar();
      const worker = iniciarWorkerDeNotificaciones({ intervaloMs: 20 });

      await new Promise((resolver) => setTimeout(resolver, 150));
      worker.detener();

      expect(testOutbox).toHaveLength(1);
      expect(await Notificacion.findOne()).toMatchObject({ estado: 'enviada' });
    });

    test('CP-INT-201 un error al procesar se registra y el worker sigue funcionando en el siguiente ciclo', async () => {
      const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
      const espia = jest.spyOn(notificaciones, 'procesarPendientes').mockRejectedValueOnce(new Error('falla puntual'));
      await agendar();

      const worker = iniciarWorkerDeNotificaciones({ intervaloMs: 20 });
      await new Promise((resolver) => setTimeout(resolver, 200));
      worker.detener();

      expect(consola).toHaveBeenCalledWith(expect.stringContaining('falla puntual'));
      expect(espia.mock.calls.length).toBeGreaterThan(1);
      expect(testOutbox).toHaveLength(1);

      espia.mockRestore();
      consola.mockRestore();
    });
  });
});
