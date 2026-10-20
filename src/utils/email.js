const nodemailer = require('nodemailer');

// Sin credenciales SMTP no hay servidor de correo real: en desarrollo se usa un
// transporte local y se imprime el código/enlace por consola.
const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Buzón en memoria solo para pruebas: permite recuperar el código o el token
 * enviado por correo sin guardarlos en claro en la base de datos.
 */
const testOutbox = [];

/** Control para simular una caída del SMTP en pruebas. */
const testControl = { fallar: false, mensaje: null };

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
  if (isTest) {
    return {
      sendMail: async () => ({ messageId: 'test-message-id' }),
    };
  }

  if (!hasSmtpCredentials) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOrFallback(transporter, options, label) {
  try {
    return await transporter.sendMail(options);
  } catch (error) {
    // En producción un fallo de correo debe ser visible; en desarrollo no debe
    // dejar al usuario sin camino porque el contenido ya quedó impreso arriba.
    if (isProduction) throw error;
    console.error(`[dev] No se pudo enviar ${label} a ${options.to}: ${error.message}`);
    return { messageId: 'dev-fallback', delivered: false };
  }
}

async function sendVerificationEmail({ to, code }) {
  const transporter = await createTransport();

  if (isTest) {
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
      from: process.env.SMTP_FROM || 'no-reply@psicogestion.com',
      to,
      subject: 'Código de verificación - PsicoGestión',
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
      from: process.env.SMTP_FROM || 'no-reply@psicogestion.com',
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
    { from: process.env.SMTP_FROM || 'no-reply@psicogestion.com', to, subject, html },
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
