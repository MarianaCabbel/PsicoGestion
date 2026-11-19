/**
 * El envío en producción usa la API HTTPS de Brevo: estos pruebas verifican el payload,
 * el remitente y la traducción de errores HTTP sin contactar con Brevo ni abrir SMTP.
 */
const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

const BASE = {
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(40),
  APP_URL: 'https://app.example.mx',
  EMAIL_TRANSPORT: 'api',
  BREVO_API_KEY: 'clave-de-prueba',
  EMAIL_FROM: 'no-reply@example.mx',
  EMAIL_FROM_NAME: 'PsicoGestion',
};

function fijarEntorno(variables) {
  const previo = { ...process.env };
  Object.keys(variables).forEach((clave) => {
    if (variables[clave] === undefined) delete process.env[clave];
    else process.env[clave] = variables[clave];
  });

  return () => {
    Object.keys(process.env).forEach((clave) => {
      if (!(clave in previo)) delete process.env[clave];
    });
    Object.assign(process.env, previo);
  };
}

function respuestaBrevo({ ok, status, body }) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('Adaptador Brevo (API HTTPS)', () => {
  let restaurarEntorno;
  let fetchOriginal;

  beforeEach(() => {
    jest.resetModules();
    restaurarEntorno = fijarEntorno(BASE);
    fetchOriginal = global.fetch;
    global.fetch = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    restaurarEntorno();
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  function cargarEmail() {
    return require('../src/utils/email');
  }

  test('envía el código por POST a la API de Brevo y devuelve el messageId', async () => {
    global.fetch.mockResolvedValue(
      respuestaBrevo({ ok: true, status: 202, body: { messageId: 'brevo-123' } }),
    );

    const resultado = await cargarEmail().sendVerificationEmail({
      to: 'alumno@uady.mx',
      code: '123456',
    });

    expect(resultado).toEqual({ messageId: 'brevo-123' });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe(URL_BREVO);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers['api-key']).toBe('clave-de-prueba');
    expect(opciones.headers['Content-Type']).toBe('application/json');

    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.sender).toEqual({ name: 'PsicoGestion', email: 'no-reply@example.mx' });
    expect(cuerpo.to).toEqual([{ email: 'alumno@uady.mx' }]);
    expect(cuerpo.subject).toMatch(/verificación/i);
    expect(cuerpo.htmlContent).toContain('123456');
    expect(cuerpo.textContent).toContain('123456');
  });

  test('acepta un EMAIL_FROM con nombre y normaliza el remitente', async () => {
    process.env.EMAIL_FROM = 'PsicoGestión <hola@example.mx>';
    global.fetch.mockResolvedValue(
      respuestaBrevo({ ok: true, status: 202, body: { messageId: 'brevo-456' } }),
    );

    await cargarEmail().sendVerificationEmail({ to: 'alumno@uady.mx', code: '654321' });

    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo.sender).toEqual({ name: 'PsicoGestión', email: 'hola@example.mx' });
  });

  test('un 401 se convierte en AppError 502 exposable con el diagnóstico', async () => {
    global.fetch.mockResolvedValue(
      respuestaBrevo({
        ok: false,
        status: 401,
        body: { code: 'unauthorized', message: 'Invalid API key' },
      }),
    );

    await expect(
      cargarEmail().sendVerificationEmail({ to: 'alumno@uady.mx', code: '123456' }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 502,
      expose: true,
      message: expect.stringContaining('No se pudo enviar el correo de verificación'),
      details: expect.stringContaining('responseCode=401'),
    });
  });

  test('un 429 incluye el código de Brevo y el mensaje de cuota', async () => {
    global.fetch.mockResolvedValue(
      respuestaBrevo({
        ok: false,
        status: 429,
        body: { code: 'rate_limit_exceeded', message: 'Quota exceeded' },
      }),
    );

    await expect(
      cargarEmail().sendVerificationEmail({ to: 'alumno@uady.mx', code: '123456' }),
    ).rejects.toMatchObject({
      statusCode: 502,
      details: expect.stringContaining('code=BREVO_rate_limit_exceeded responseCode=429'),
    });
  });

  test('un EMAIL_FROM vacío falla antes de llamar a la API', async () => {
    delete process.env.EMAIL_FROM;

    await expect(
      cargarEmail().sendVerificationEmail({ to: 'alumno@uady.mx', code: '123456' }),
    ).rejects.toMatchObject({
      statusCode: 502,
      details: expect.stringContaining('EMAIL_FROM no es una dirección válida'),
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sin BREVO_API_KEY falla antes de llamar a la API', async () => {
    delete process.env.BREVO_API_KEY;

    await expect(
      cargarEmail().sendVerificationEmail({ to: 'alumno@uady.mx', code: '123456' }),
    ).rejects.toMatchObject({
      statusCode: 502,
      details: expect.stringContaining('BREVO_API_KEY no configurada'),
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
