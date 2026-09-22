const nodemailer = require('nodemailer');

async function createTransport() {
  if (process.env.NODE_ENV === 'test') {
    return {
      sendMail: async () => ({ messageId: 'test-message-id' }),
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendVerificationEmail({ to, code }) {
  const transporter = await createTransport();

  if (process.env.NODE_ENV === 'test') {
    return { ok: true, messageId: 'test-verification-message' };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@psicogestion.com',
    to,
    subject: 'Código de verificación - PsicoGestión',
    html: `
      <h3>Verificación de cuenta</h3>
      <p>Tu código de verificación es:</p>
      <h2>${code}</h2>
      <p>Ingresa este código para completar tu registro.</p>
    `,
  });

  return info;
}

async function sendResetEmail({ to, token }) {
  const transporter = await createTransport();

  if (process.env.NODE_ENV === 'test') {
    return { ok: true, token };
  }

  const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@psicogestion.com',
    to,
    subject: 'Recuperación de contraseña - PsicoGestión',
    html: `
      <h3>Restablece tu contraseña</h3>
      <p>Haz clic en el siguiente enlace para continuar:</p>
      <a href="${resetLink}">${resetLink}</a>
    `,
  });

  return info;
}

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
};
