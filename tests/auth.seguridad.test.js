const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { User, CorreoAutorizado } = require('../src/config/database');
const {
  hashResetToken,
  generateVerificationCode,
  isInstitutionalEmail,
  MAX_VERIFICATION_ATTEMPTS,
} = require('../src/utils/authHelpers');
const { getJwtSecret, getRegistroModo, assertEnvironment, getAllowedOrigins } = require('../src/config/env');
const { parseCookies } = require('../src/lib/cookies');
const {
  VALID_EMAIL,
  VALID_PASSWORD,
  useTestDatabase,
  seedVerifiedUser,
  register,
  loginAndToken,
  ultimoTokenRecuperacion,
  bearer,
} = require('./helpers');

const NUEVA_PASSWORD = 'NuevaClave2024!';

// Una sola base en memoria para todo el archivo: useTestDatabase la cierra al terminar.
useTestDatabase();

function conEntorno(variables, fn) {
  const previo = {};
  Object.keys(variables).forEach((clave) => {
    previo[clave] = process.env[clave];
    if (variables[clave] === undefined) delete process.env[clave];
    else process.env[clave] = variables[clave];
  });

  const restaurar = () =>
    Object.keys(previo).forEach((clave) => {
      if (previo[clave] === undefined) delete process.env[clave];
      else process.env[clave] = previo[clave];
    });

  const resultado = fn();
  if (resultado && typeof resultado.then === 'function') return resultado.finally(restaurar);
  restaurar();
  return resultado;
}

describe('Token de recuperación guardado como huella (D-1)', () => {
  test('CP-INT-70 la base solo contiene el SHA-256 del token, nunca el token en claro', async () => {
    await seedVerifiedUser();
    await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });

    const token = ultimoTokenRecuperacion();
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(user.reset_token_hash).not.toBe(token);
    expect(user.reset_token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(user.reset_token_hash).toBe(hashResetToken(token));
  });

  test('CP-INT-70 con acceso de lectura a la base no se puede restablecer: la huella no es un token válido', async () => {
    await seedVerifiedUser();
    await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });
    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });

    const res = await request(app).post('/api/auth/restablecer').send({
      token: user.reset_token_hash,
      nueva_password: NUEVA_PASSWORD,
      confirmar_password: NUEVA_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El token de restablecimiento es inválido o ha expirado.');
  });

  test('CP-INT-70 el token es de un solo uso', async () => {
    await seedVerifiedUser();
    await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });
    const token = ultimoTokenRecuperacion();
    const cuerpo = { token, nueva_password: NUEVA_PASSWORD, confirmar_password: NUEVA_PASSWORD };

    expect((await request(app).post('/api/auth/restablecer').send(cuerpo)).status).toBe(200);
    expect((await request(app).post('/api/auth/restablecer').send(cuerpo)).status).toBe(400);
  });
});

describe('Invalidación de sesiones al restablecer la contraseña (D-2)', () => {
  test('CP-INT-71 el JWT emitido antes del restablecimiento deja de ser válido', async () => {
    await seedVerifiedUser();
    const tokenViejo = await loginAndToken(app);

    expect((await request(app).get('/api/auth/me').set(bearer(tokenViejo))).status).toBe(200);

    await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });
    const reset = await request(app).post('/api/auth/restablecer').send({
      token: ultimoTokenRecuperacion(),
      nueva_password: NUEVA_PASSWORD,
      confirmar_password: NUEVA_PASSWORD,
    });
    expect(reset.status).toBe(200);

    const sesionVieja = await request(app).get('/api/auth/me').set(bearer(tokenViejo));
    expect(sesionVieja.status).toBe(401);
    expect(sesionVieja.body.message).toBe('La sesión ya no es válida. Inicia sesión de nuevo.');

    const loginNuevo = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: VALID_EMAIL, password: NUEVA_PASSWORD });
    expect(loginNuevo.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(loginNuevo.body.data.token))).status).toBe(200);
  });

  test('CP-INT-71 incrementa token_version exactamente una vez', async () => {
    await seedVerifiedUser();
    await request(app).post('/api/auth/recuperar').send({ correo_institucional: VALID_EMAIL });
    await request(app).post('/api/auth/restablecer').send({
      token: ultimoTokenRecuperacion(),
      nueva_password: NUEVA_PASSWORD,
      confirmar_password: NUEVA_PASSWORD,
    });

    const user = await User.findOne({ where: { correo_institucional: VALID_EMAIL } });
    expect(user.token_version).toBe(1);
  });
});

describe('Límite de 3 intentos del código de verificación', () => {
  const verificar = (codigo) =>
    request(app).post('/api/auth/verificar').send({ correo_institucional: VALID_EMAIL, codigo_verificacion: codigo });

  async function usuarioPendiente() {
    await register(app);
    return User.findOne({ where: { correo_institucional: VALID_EMAIL } });
  }

  const incorrecto = (codigo) => String((Number(codigo) + 1) % 1000000).padStart(6, '0');

  test('CP-INT-72 el máximo configurado es 3 intentos', () => {
    expect(MAX_VERIFICATION_ATTEMPTS).toBe(3);
  });

  test('CP-INT-72 informa los intentos restantes y bloquea el código en el tercer fallo', async () => {
    const user = await usuarioPendiente();
    const mal = incorrecto(user.codigo_verificacion);

    const primero = await verificar(mal);
    expect(primero.status).toBe(400);
    expect(primero.body.intentos_restantes).toBe(2);

    const segundo = await verificar(mal);
    expect(segundo.status).toBe(400);
    expect(segundo.body.intentos_restantes).toBe(1);

    const tercero = await verificar(mal);
    expect(tercero.status).toBe(429);
    expect(tercero.body.message).toBe('Superaste el número de intentos permitidos. Solicita un código nuevo.');

    await user.reload();
    expect(user.codigo_verificacion).toBeNull();
    expect(user.verificado).toBe(false);
  });

  test('CP-INT-72 tras el bloqueo ni el código correcto original sirve', async () => {
    const user = await usuarioPendiente();
    const correcto = user.codigo_verificacion;
    const mal = incorrecto(correcto);

    await verificar(mal);
    await verificar(mal);
    await verificar(mal);

    const res = await verificar(correcto);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No hay un código vigente. Solicita uno nuevo.');
  });

  test('CP-INT-72 reenviar el código reinicia los intentos y permite verificar', async () => {
    const user = await usuarioPendiente();
    const mal = incorrecto(user.codigo_verificacion);
    await verificar(mal);
    await verificar(mal);
    await verificar(mal);

    await request(app).post('/api/auth/reenviar-codigo').send({ correo_institucional: VALID_EMAIL });
    await user.reload();

    expect(user.codigo_intentos).toBe(0);
    expect(user.codigo_verificacion).toMatch(/^\d{6}$/);

    const res = await verificar(user.codigo_verificacion);
    expect(res.status).toBe(200);
  });

  test('CP-INT-72 dos fallos seguidos de un acierto no bloquean la cuenta', async () => {
    const user = await usuarioPendiente();
    const correcto = user.codigo_verificacion;

    await verificar(incorrecto(correcto));
    await verificar(incorrecto(correcto));
    const res = await verificar(correcto);

    expect(res.status).toBe(200);
    await user.reload();
    expect(user.verificado).toBe(true);
    expect(user.codigo_intentos).toBe(0);
  });

  test('CP-INT-73 un correo inexistente o ya verificado recibe la misma respuesta genérica', async () => {
    await seedVerifiedUser();

    const inexistente = await request(app)
      .post('/api/auth/verificar')
      .send({ correo_institucional: 'nadie@correo.uady.mx', codigo_verificacion: '123456' });
    const yaVerificado = await verificar('123456');

    expect(inexistente.status).toBe(400);
    expect(yaVerificado.status).toBe(400);
    expect(yaVerificado.body.message).toBe(inexistente.body.message);
  });

  test('CP-INT-73 el generador produce códigos de 6 dígitos sin ceros a la izquierda', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateVerificationCode()).toMatch(/^[1-9]\d{5}$/);
    }
  });
});

describe('Lista blanca de registro', () => {
  test('CP-INT-74 en modo lista_blanca un correo UADY no autorizado no puede registrarse', async () => {
    await conEntorno({ REGISTRO_MODO: 'lista_blanca' }, async () => {
      const res = await register(app);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/no está autorizado/);
      expect(await User.count()).toBe(0);
    });
  });

  test('CP-INT-74 un correo autorizado sí puede registrarse (sin distinguir mayúsculas)', async () => {
    await conEntorno({ REGISTRO_MODO: 'lista_blanca' }, async () => {
      await CorreoAutorizado.create({ correo: VALID_EMAIL });

      const res = await register(app, { correo_institucional: 'ANA@correo.uady.mx' });
      expect(res.status).toBe(201);
    });
  });

  test('CP-INT-74 una autorización revocada deja de servir', async () => {
    await conEntorno({ REGISTRO_MODO: 'lista_blanca' }, async () => {
      await CorreoAutorizado.create({ correo: VALID_EMAIL, activo: false });

      const res = await register(app);
      expect(res.status).toBe(403);
    });
  });

  test('CP-INT-74 la lista blanca no sustituye la validación de dominio', async () => {
    await conEntorno({ REGISTRO_MODO: 'lista_blanca' }, async () => {
      await CorreoAutorizado.create({ correo: 'ana@gmail.com' });

      const res = await register(app, { correo_institucional: 'ana@gmail.com' });
      expect(res.status).toBe(400);
    });
  });

  test('CP-INT-75 el modo por defecto es lista blanca en producción y dominio en desarrollo', () => {
    conEntorno({ REGISTRO_MODO: undefined, NODE_ENV: 'production' }, () => {
      expect(getRegistroModo()).toBe('lista_blanca');
    });
    conEntorno({ REGISTRO_MODO: undefined, NODE_ENV: 'development' }, () => {
      expect(getRegistroModo()).toBe('dominio');
    });
    conEntorno({ REGISTRO_MODO: 'dominio', NODE_ENV: 'production' }, () => {
      expect(getRegistroModo()).toBe('dominio');
    });
  });

  test('CP-INT-75 dominios institucionales adicionales se configuran por entorno', () => {
    expect(isInstitutionalEmail('a@clinica.org')).toBe(false);

    conEntorno({ DOMINIOS_INSTITUCIONALES_EXTRA: 'clinica.org, otra.mx' }, () => {
      expect(isInstitutionalEmail('a@clinica.org')).toBe(true);
      expect(isInstitutionalEmail('a@OTRA.mx')).toBe(true);
      expect(isInstitutionalEmail('a@evil.com')).toBe(false);
      expect(isInstitutionalEmail('a@clinica.org.evil.com')).toBe(false);
    });
  });
});

describe('Sesión por cookie httpOnly, CORS y cabeceras', () => {
  test('CP-INT-76 el login emite una cookie httpOnly y /me funciona solo con la cookie', async () => {
    await seedVerifiedUser();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ correo_institucional: VALID_EMAIL, password: VALID_PASSWORD });

    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('pg_session='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);

    const valor = parseCookies(cookie.split(';')[0]).pg_session;
    const me = await request(app).get('/api/auth/me').set('Cookie', `pg_session=${valor}`);

    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ correo_institucional: VALID_EMAIL, rol: 'secretaria' });
  });

  test('CP-INT-76 el logout borra la cookie e invalida la sesión', async () => {
    await seedVerifiedUser();
    const token = await loginAndToken(app);

    const logout = await request(app).post('/api/auth/logout').set(bearer(token));
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'].join(';')).toMatch(/pg_session=;/);

    expect((await request(app).get('/api/auth/me').set('Cookie', `pg_session=${token}`)).status).toBe(401);
  });

  test('CP-INT-76 sin token ni cookie, /me responde 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test('CP-INT-77 una petición que modifica datos desde un origen no autorizado se rechaza', async () => {
    await seedVerifiedUser();
    const token = await loginAndToken(app);

    const ajeno = await request(app)
      .post('/api/auth/logout')
      .set(bearer(token))
      .set('Origin', 'https://sitio-malicioso.example');
    expect(ajeno.status).toBe(403);
    expect(ajeno.body.message).toBe('Origen no autorizado.');

    const propio = await request(app)
      .post('/api/auth/logout')
      .set(bearer(token))
      .set('Origin', 'http://localhost:3000');
    expect(propio.status).toBe(200);
  });

  test('CP-INT-77 CORS solo responde a los orígenes autorizados y permite credenciales', async () => {
    const permitido = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(permitido.headers['access-control-allow-credentials']).toBe('true');

    const ajeno = await request(app).get('/health').set('Origin', 'https://sitio-malicioso.example');
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('CP-INT-77 envía cabeceras de seguridad y no revela Express', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeTruthy();
  });

  test('CP-INT-78 responde 404 JSON a rutas inexistentes y 400 a JSON mal formado', async () => {
    const inexistente = await request(app).get('/api/no-existe');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toEqual({ success: false, message: 'Recurso no encontrado.' });

    const malFormado = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"correo": ');
    expect(malFormado.status).toBe(400);
    expect(malFormado.body.message).toBe('El cuerpo de la petición no es un JSON válido.');
  });

  test('CP-INT-78 /health/ready confirma la conexión con la base de datos', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
  });
});

describe('Rutas protegidas', () => {
  test.each([
    ['get', '/api/auth/me'],
    ['get', '/api/pacientes'],
    ['post', '/api/pacientes'],
    ['get', '/api/pacientes/1'],
    ['put', '/api/pacientes/1'],
    ['delete', '/api/pacientes/1'],
    ['post', '/api/pacientes/1/reactivar'],
    ['post', '/api/pacientes/1/consentimiento'],
    ['get', '/api/terapeutas'],
    ['post', '/api/terapeutas'],
    ['get', '/api/terapeutas/1'],
    ['put', '/api/terapeutas/1'],
    ['delete', '/api/terapeutas/1'],
    ['post', '/api/terapeutas/1/reactivar'],
    ['put', '/api/terapeutas/1/foto'],
    ['get', '/api/terapeutas/1/foto'],
    ['get', '/api/terapeutas/1/horarios'],
    ['put', '/api/terapeutas/1/horarios'],
  ])('CP-INT-79 %s %s exige autenticación', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).send({});
    expect(res.status).toBe(401);
  });

  test('CP-INT-79 un token con firma inválida o manipulado se rechaza', async () => {
    const res = await request(app).get('/api/pacientes').set(bearer('abc.def.ghi'));
    expect(res.status).toBe(401);
  });
});

describe('Configuración de entorno', () => {
  test('CP-UNI-33 JWT_SECRET es obligatorio y de al menos 32 caracteres en producción', () => {
    conEntorno({ NODE_ENV: 'production', JWT_SECRET: undefined }, () => {
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET es obligatorio/);
    });
    conEntorno({ NODE_ENV: 'production', JWT_SECRET: 'corto' }, () => {
      expect(() => getJwtSecret()).toThrow(/al menos 32 caracteres/);
    });
    conEntorno({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }, () => {
      expect(getJwtSecret()).toBe('x'.repeat(32));
    });
  });

  test('CP-UNI-33 fuera de producción se permite el secreto de desarrollo', () => {
    conEntorno({ NODE_ENV: 'development', JWT_SECRET: undefined }, () => {
      expect(getJwtSecret()).toBe('dev-secret');
    });
  });

  test('CP-UNI-33 en producción el arranque exige APP_URL/CORS y credenciales SMTP', () => {
    const base = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) };

    conEntorno({ ...base, APP_URL: undefined, CORS_ORIGINS: undefined, SMTP_USER: 'u', SMTP_PASS: 'p' }, () => {
      expect(() => assertEnvironment()).toThrow(/APP_URL o CORS_ORIGINS/);
    });
    conEntorno({ ...base, APP_URL: 'https://app.example.mx', SMTP_USER: undefined, SMTP_PASS: undefined }, () => {
      expect(() => assertEnvironment()).toThrow(/SMTP_USER/);
    });
    conEntorno({ ...base, APP_URL: 'https://app.example.mx', SMTP_USER: 'u', SMTP_PASS: 'p' }, () => {
      expect(() => assertEnvironment()).not.toThrow();
    });
  });

  test('CP-UNI-33 los orígenes permitidos combinan APP_URL y CORS_ORIGINS', () => {
    conEntorno(
      { NODE_ENV: 'production', APP_URL: 'https://app.example.mx/ruta', CORS_ORIGINS: 'https://otro.example.mx, ' },
      () => {
        expect(getAllowedOrigins().sort()).toEqual(['https://app.example.mx', 'https://otro.example.mx']);
      }
    );
  });
});
