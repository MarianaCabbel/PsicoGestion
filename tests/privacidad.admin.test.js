const request = require('supertest');
const app = require('../src/app');
const {
  AuditLog,
  Cita,
  CitaOcupacion,
  Notificacion,
  Paciente,
  User,
} = require('../src/config/database');
const reloj = require('../src/lib/reloj');
const { useTestDatabase, seedVerifiedUser, VALID_PASSWORD, bearer } = require('./helpers');
const {
  crearPaciente,
  crearSala,
  crearTerapeutaConHorario,
  insertarCita,
  enMerida,
} = require('./fixtures');

describe('Privacidad ARCO y administración', () => {
  useTestDatabase();
  let adminToken;
  let secretariaToken;
  let admin;
  let secretaria;

  beforeEach(async () => {
    reloj.fijarAhora(enMerida('2026-10-25', '11:00'));
    secretaria = await seedVerifiedUser();
    admin = await seedVerifiedUser({
      nombre_completo: 'Administradora',
      correo_institucional: 'admin@correo.uady.mx',
      telefono: '9990000001',
      rol: 'administrador',
    });
    const [adminLogin, secretariaLogin] = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ correo_institucional: 'admin@correo.uady.mx', password: VALID_PASSWORD }),
      request(app)
        .post('/api/auth/login')
        .send({ correo_institucional: secretaria.correo_institucional, password: VALID_PASSWORD }),
    ]);
    adminToken = adminLogin.body.data.token;
    secretariaToken = secretariaLogin.body.data.token;
  });

  test('exporta los datos del paciente y registra el acceso sin copiar PII al detalle de auditoría', async () => {
    const paciente = await crearPaciente();
    const sala = await crearSala('Sala ARCO');
    const terapeuta = await crearTerapeutaConHorario();
    const cita = await insertarCita({
      paciente,
      sala,
      terapeuta,
      fecha: '2026-10-23',
      estado: 'cancelada',
    });

    const response = await request(app)
      .get(`/api/pacientes/${paciente.id}/exportar`)
      .set(bearer(secretariaToken));

    expect(response.status).toBe(200);
    expect(response.body.data.paciente.curp).toBe(paciente.curp);
    expect(response.body.data.citas).toHaveLength(1);
    expect(response.body.data.citas[0].folio).toBe(cita.folio);
    const audit = await AuditLog.findOne({
      where: { accion: 'exportar', entidad_id: paciente.id },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit.detalle)).not.toContain(paciente.curp);
    expect(JSON.stringify(audit.detalle)).not.toContain(paciente.nombre_completo);
  });

  test('protege exportación, bitácora y administración con autenticación y rol administrador', async () => {
    const paciente = await crearPaciente();
    expect((await request(app).get(`/api/pacientes/${paciente.id}/exportar`)).status).toBe(401);
    expect((await request(app).get('/api/auditoria')).status).toBe(401);
    expect((await request(app).get('/api/admin/correos-autorizados')).status).toBe(401);
    expect((await request(app).get('/api/auditoria').set(bearer(secretariaToken))).status).toBe(
      403,
    );
    expect(
      (await request(app).get('/api/admin/correos-autorizados').set(bearer(secretariaToken)))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/admin/usuarios/${secretaria.id}/rol`)
          .set(bearer(secretariaToken))
          .send({ rol: 'administrador' })
      ).status,
    ).toBe(403);
  });

  test('requiere doble confirmación, bloquea citas futuras y conserva las citas al anonimizar', async () => {
    const paciente = await crearPaciente();
    const sala = await crearSala('Sala ARCO');
    const terapeuta = await crearTerapeutaConHorario();
    await insertarCita({
      paciente,
      sala,
      terapeuta,
      fecha: '2026-10-26',
      estado: 'pendiente',
    });

    const sinConfirmar = await request(app)
      .post(`/api/pacientes/${paciente.id}/anonimizar`)
      .set(bearer(adminToken))
      .send({ confirmar: true, confirmacion: 'ANONIMIZAR' });
    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.citas_futuras_pendientes).toBe(1);
    expect((await Paciente.findByPk(paciente.id)).curp).toBe(paciente.curp);

    await Cita.update({ estado: 'cancelada' }, { where: { paciente_id: paciente.id } });
    await CitaOcupacion.destroy({ where: { paciente_id: paciente.id } });
    const pastAppointment = await insertarCita({
      paciente,
      sala,
      terapeuta,
      fecha: '2026-10-23',
    });
    await Cita.update(
      {
        motivo_cancelacion: `Solicitud de ${paciente.nombre_completo}`,
        cancelada_por: secretaria.id,
        creada_por: secretaria.id,
      },
      { where: { id: pastAppointment.id } },
    );
    const notification = await Notificacion.create({
      tipo: 'confirmacion',
      cita_id: pastAppointment.id,
      destinatario: paciente.correo,
      estado: 'pendiente',
      intentos: 1,
      proximo_intento_at: new Date(),
      ultimo_error: `No se entregó a ${paciente.correo}`,
    });

    const wrongPhrase = await request(app)
      .post(`/api/pacientes/${paciente.id}/anonimizar`)
      .set(bearer(adminToken))
      .send({ confirmar: true, confirmacion: 'SI' });
    expect(wrongPhrase.status).toBe(400);

    const response = await request(app)
      .post(`/api/pacientes/${paciente.id}/anonimizar`)
      .set(bearer(adminToken))
      .send({ confirmar: true, confirmacion: 'ANONIMIZAR' });
    expect(response.status).toBe(200);

    const pacienteAnonimizado = await Paciente.findByPk(paciente.id, { paranoid: false });
    expect(pacienteAnonimizado.nombre_completo).toBe(`Paciente anonimizado ${paciente.id}`);
    expect(pacienteAnonimizado.curp).not.toBe(paciente.curp);
    expect(pacienteAnonimizado.telefono).toBe('0000000000');
    expect(pacienteAnonimizado.correo).toBeNull();
    expect(pacienteAnonimizado.consentimiento_at).toBeNull();
    expect(pacienteAnonimizado.anonimizado_at).toBeTruthy();
    expect(pacienteAnonimizado.baja_at).toBeTruthy();
    const exportedAnonymous = await request(app)
      .get(`/api/pacientes/${paciente.id}/exportar`)
      .set(bearer(adminToken));
    expect(exportedAnonymous.body.data.paciente.edad).toBeNull();
    expect(
      (await request(app).post(`/api/pacientes/${paciente.id}/reactivar`).set(bearer(adminToken)))
        .status,
    ).toBe(409);
    expect(await Cita.count({ where: { paciente_id: paciente.id } })).toBe(2);
    const preservedAppointment = await Cita.findByPk(pastAppointment.id);
    expect(preservedAppointment).not.toBeNull();
    expect(preservedAppointment.motivo_cancelacion).toBeNull();
    expect(preservedAppointment.cancelada_por).toBeNull();
    expect(preservedAppointment.creada_por).toBeNull();
    await notification.reload();
    expect(notification.destinatario).toBe('anonimizado@invalid');
    expect(notification.ultimo_error).toBeNull();
    expect(notification.estado).toBe('omitida');
  });

  test('filtra bitácora, redacta detalles y administra correos y roles con invalidación de token', async () => {
    await AuditLog.create({
      usuario_id: admin.id,
      accion: 'exportar',
      entidad: 'paciente',
      entidad_id: 999,
      detalle: { nombre_completo: 'Nombre confidencial', correo: 'privado@example.com' },
    });
    const auditResponse = await request(app)
      .get('/api/auditoria?accion=exportar&page=1&limit=10')
      .set(bearer(adminToken));
    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.data.items[0].detalle).toBeNull();
    expect(JSON.stringify(auditResponse.body)).not.toContain('Nombre confidencial');
    const noResults = await request(app)
      .get('/api/auditoria?desde=2099-01-01&hasta=2099-01-02')
      .set(bearer(adminToken));
    expect(noResults.body.data.total).toBe(0);
    expect(
      (await request(app).get('/api/admin/usuarios').set(bearer(adminToken))).body.data.items.some(
        (user) => Object.hasOwn(user, 'password_hash'),
      ),
    ).toBe(false);

    const authorized = await request(app)
      .post('/api/admin/correos-autorizados')
      .set(bearer(adminToken))
      .send({ correo: '  NUEVO@CORREO.UADY.MX ' });
    expect(authorized.status).toBe(201);
    expect(authorized.body.data.correo).toBe('nuevo@correo.uady.mx');
    const emailList = await request(app)
      .get('/api/admin/correos-autorizados?page=1&limit=10')
      .set(bearer(adminToken));
    expect(emailList.body.data.items).toHaveLength(1);
    expect(emailList.body.data.items[0].correo).toBe('nuevo@correo.uady.mx');
    expect(
      (
        await request(app)
          .delete(`/api/admin/correos-autorizados/${authorized.body.data.id}`)
          .set(bearer(adminToken))
      ).status,
    ).toBe(200);

    const rolResponse = await request(app)
      .put(`/api/admin/usuarios/${secretaria.id}/rol`)
      .set(bearer(adminToken))
      .send({ rol: 'administrador' });
    expect(rolResponse.status).toBe(200);
    expect(rolResponse.body.data.rol).toBe('administrador');
    const updatedUser = await User.findByPk(secretaria.id);
    expect(updatedUser.token_version).toBe(1);
    expect((await request(app).get('/api/auth/me').set(bearer(secretariaToken))).status).toBe(401);
  });
});
