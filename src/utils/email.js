const nodemailer = require('nodemailer');
const { AppError } = require('./errors');
const { getEmailTransport } = require('../config/env');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const EMAIL_TRANSPORT = getEmailTransport();

// Sin credenciales SMTP no hay servidor de correo real: en desarrollo se usa un
// transporte local y se imprime el código/enlace por consola.
const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

if (!isTest) {
  console.log(
    `[correo] Transporte configurado: ${
      EMAIL_TRANSPORT === 'api' ? 'API HTTPS (Brevo)' : 'SMTP'
    }`,
  );
}

/**
 * Buzón en memoria solo para pruebas: permite recuperar el código o el token
 * enviado por correo sin guardarlos en claro en la base de datos.
 */
const testOutbox = [];

/** Control para simular una caída del SMTP en pruebas. */
const testControl = { fallar: false, mensaje: null };

/** Evita que un SMTP que no responde deje la petición de registro colgada. */
const SMTP_TIMEOUT_MS = 10000;
const SMTP_SOCKET_TIMEOUT_MS = 15000;

function resumenError(error) {
  const partes = [
    error?.code && `code=${error.code}`,
    error?.responseCode && `responseCode=${error.responseCode}`,
    error?.command && `command=${error.command}`,
    error?.response && `response=${String(error.response).slice(0, 200)}`,
  ].filter(Boolean);

  return partes.join(' ') || error?.message || 'sin detalles';
}

/** Error accionable para el usuario, con el diagnóstico del proveedor en `details`. */
function errorDeEnvio(label, cause) {
  const proveedor = EMAIL_TRANSPORT === 'api' ? 'Brevo' : 'SMTP';
  // sendOrFallback vuelve a envolver los errores del adaptador: conservar `details`
  // evita que el diagnostic real (HTTP, código de Brevo, etc.) se pierda en el log.
  const details = cause?.details || resumenError(cause);
  const error = new AppError(
    `No se pudo enviar ${label}. Revisa la configuración de correo (${proveedor}) del servidor e inténtalo de nuevo.`,
    502,
    details,
    null,
    null,
    true,
  );
  error.cause = cause?.cause || cause;
  return error;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/** Acepta `correo@dominio.com` y `Nombre <correo@dominio.com>`. */
function remitenteBrevo(from) {
  const valor = String(from || '').trim();
  const coincidencia = valor.match(/<([^>]+)>/);
  const email = (coincidencia ? coincidencia[1] : valor).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errorDeEnvio(
      'el correo',
      new Error(`EMAIL_FROM no es una dirección válida: ${email || '(vacío)'}.`),
    );
  }

  const nombre = coincidencia
    ? valor.slice(0, coincidencia.index).trim().replace(/^["']|["']$/g, '')
    : '';
  return { name: nombre || process.env.EMAIL_FROM_NAME || 'PsicoGestión', email };
}

function obtenerRemitente() {
  return EMAIL_TRANSPORT === 'api'
    ? process.env.EMAIL_FROM || ''
    : process.env.SMTP_FROM || 'no-reply@psicogestion.com';
}

async function enviarPorBrevo(options, label) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw errorDeEnvio(label, new Error('BREVO_API_KEY no configurada.'));

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: remitenteBrevo(options.from),
      to: Array.isArray(options.to) ? options.to : [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
      ...(options.text ? { textContent: options.text } : {}),
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    // Brevo responde JSON; si no, conservamos el código HTTP como diagnóstico.
  }

  if (!response.ok) {
    const detalle = payload?.message || `HTTP ${response.status}`;
    throw errorDeEnvio(label, {
      code: payload?.code ? `BREVO_${payload.code}` : 'BREVO_HTTP',
      responseCode: response.status,
      response: detalle,
      message: detalle,
    });
  }

  return { messageId: payload?.messageId || 'brevo-sin-id' };
}

const ASUNTOS_CITA = {
  confirmacion: 'Confirmación de cita - PsicoGestión',
  modificacion: 'Tu cita fue modificada - PsicoGestión',
  cancelacion: 'Tu cita fue cancelada - PsicoGestión',
};

const ENCABEZADOS_CITA = {
  confirmacion: 'Tu cita fue agendada',
  modificacion: 'Tu cita fue modificada',
  cancelacion: 'Tu cita fue cancelada',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createTransport() {
  // La API HTTPS no usa nodemailer: Render free bloquea los puertos SMTP.
  if (EMAIL_TRANSPORT === 'api') return null;

  if (isTest) {
    return {
      sendMail: async () => ({ messageId: 'test-message-id' }),
    };
  }

  if (!hasSmtpCredentials) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`SMTP_PORT no es válido: ${process.env.SMTP_PORT}`);
  }

  const secure =
    process.env.SMTP_SECURE === undefined || process.env.SMTP_SECURE === ''
      ? port === 465
      : process.env.SMTP_SECURE === 'true';

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    // En producción sobre 587 el servidor debe ofrecer STARTTLS: nunca enviar
    // credenciales en claro. En desarrollo se permite un SMTP local sin TLS.
    requireTLS: isProduction && !secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
}

async function sendOrFallback(transporter, options, label) {
  try {
    const resultado =
      EMAIL_TRANSPORT === 'api'
        ? await enviarPorBrevo(options, label)
        : await transporter.sendMail(options);
    if (!isTest) {
      console.log(
        `[correo] ${label} enviado a ${options.to} (messageId=${resultado.messageId || 'desconocido'}).`,
      );
    }
    return resultado;
  } catch (cause) {
    // Siempre dejar constancia del motivo: en Render es la única forma de saber
    // si fue autenticación, red o timeout.
    console.error(`[correo] Fallo al enviar ${label} a ${options.to}: ${resumenError(cause)}`);

    // En producción un fallo de correo debe ser visible; en desarrollo no debe
    // dejar al usuario sin camino porque el contenido ya quedó impreso arriba.
    if (isProduction) throw errorDeEnvio(label, cause);
    return { messageId: 'dev-fallback', delivered: false };
  }
}

async function sendVerificationEmail({ to, code }) {
  const transporter = await createTransport();

  if (isTest) {
    if (testControl.fallar) {
      throw errorDeEnvio(
        'el correo de verificación',
        new Error(testControl.mensaje || 'SMTP no disponible (simulado)'),
      );
    }
    testOutbox.push({ tipo: 'verificacion', to, code });
    return { ok: true, messageId: 'test-verification-message' };
  }

  // Se imprime antes de enviar: si el SMTP falla, el código sigue disponible.
  if (!isProduction) {
    console.log(`[dev] Código de verificación para ${to}: ${code}`);
  }

  return sendOrFallback(
    transporter,
    {
      from: obtenerRemitente(),
      to,
      subject: 'Código de verificación - PsicoGestión',
      // La versión de texto mejora la entregabilidad en clientes que bloquean HTML.
      text: `Tu código de verificación de PsicoGestión es ${code}. Vence en 10 minutos y se bloquea tras 3 intentos fallidos.`,
      html: `
      <h3>Verificación de cuenta</h3>
      <p>Tu código de verificación es:</p>
      <h2>${escapeHtml(code)}</h2>
      <p>Ingresa este código para completar tu registro. Vence en 10 minutos y se bloquea tras 3 intentos fallidos.</p>
    `,
    },
    'el correo de verificación',
  );
}

async function sendResetEmail({ to, token }) {
  const transporter = await createTransport();

  if (isTest) {
    testOutbox.push({ tipo: 'recuperacion', to, token });
    return { ok: true, token };
  }

  const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;

  if (!isProduction) {
    console.log(`[dev] Enlace de restablecimiento para ${to}: ${resetLink}`);
  }

  return sendOrFallback(
    transporter,
    {
      from: obtenerRemitente(),
      to,
      subject: 'Recuperación de contraseña - PsicoGestión',
      html: `
      <h3>Restablece tu contraseña</h3>
      <p>Haz clic en el siguiente enlace para continuar. Vence en 10 minutos:</p>
      <a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a>
    `,
    },
    'el correo de recuperación',
  );
}

/**
 * Arma asunto y HTML del correo de una cita. Todo dato variable se escapa: un nombre
 * con "<" o "&" no puede romper ni inyectar HTML.
 */
function construirCorreoDeCita({ tipo, cita }) {
  const filas = [
    ['Folio', cita.folio],
    ['Paciente', cita.paciente_nombre],
    ['Fecha', cita.fecha_larga],
    ['Horario', `${cita.hora_inicio} a ${cita.hora_fin}`],
    ['Terapeuta', cita.terapeuta_nombre],
    ['Sala', cita.sala_nombre],
  ]
    .map(([etiqueta, valor]) => `<tr><td><strong>${escapeHtml(etiqueta)}</strong></td><td>${escapeHtml(valor)}</td></tr>`)
    .join('');

  const motivo =
    tipo === 'cancelacion' && cita.motivo_cancelacion
      ? `<p>Motivo: ${escapeHtml(cita.motivo_cancelacion)}</p>`
      : '';

  return {
    subject: ASUNTOS_CITA[tipo],
    html: `
      <h3>${escapeHtml(ENCABEZADOS_CITA[tipo])}</h3>
      <table cellpadding="4">${filas}</table>
      ${motivo}
      <p>Conserva tu folio: lo necesitarás para cancelar o consultar tu cita.</p>
    `,
  };
}

/** Correo de una cita (confirmación, modificación o cancelación). */
async function sendCitaEmail({ to, tipo, cita }) {
  const transporter = await createTransport();

  if (isTest) {
    if (testControl.fallar) {
      throw new Error(testControl.mensaje || 'SMTP no disponible (simulado)');
    }
    testOutbox.push({ tipo: `cita:${tipo}`, to, cita });
    return { ok: true };
  }

  const { subject, html } = construirCorreoDeCita({ tipo, cita });

  return sendOrFallback(
    transporter,
    { from: obtenerRemitente(), to, subject, html },
    'el correo de la cita'
  );
}

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
  sendCitaEmail,
  construirCorreoDeCita,
  escapeHtml,
  testOutbox,
  testControl,
};
