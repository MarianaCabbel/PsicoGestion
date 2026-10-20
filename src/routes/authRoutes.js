const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../config/database');
const { AppError } = require('../utils/errors');
const {
  VERIFICATION_CODE_TTL_MS,
  RESET_LINK_TTL_MS,
  isInstitutionalEmail,
  normalizePhone,
  isValidPhone,
  normalizeEmail,
  validatePassword,
  validateUniqueCredentials,
  generateVerificationCode,
  verifyVerificationCode,
  isVerificationCodeExpired,
  generateResetToken,
  hashResetToken,
  MAX_VERIFICATION_ATTEMPTS,
} = require('../utils/authHelpers');
const { sendVerificationEmail, sendResetEmail } = require('../utils/email');
const { authenticateToken } = require('../middleware/authMiddleware');
const { limitadores } = require('../middleware/rateLimiters');
const { getJwtSecret } = require('../config/env');
const { setSessionCookie, clearSessionCookie } = require('../lib/cookies');
const { correoAutorizadoParaRegistro } = require('../modules/auth/registroPolicy');

const router = express.Router();

function buildToken(user) {
  return jwt.sign(
    {
      id: user.id,
      correo_institucional: user.correo_institucional,
      ver: user.token_version,
    },
    getJwtSecret(),
    { expiresIn: '8h' }
  );
}

router.post('/registro', limitadores.registro, async (req, res, next) => {
  try {
    const { nombre_completo, correo_institucional, telefono, password, confirmar_password } = req.body;

    if (
      !String(nombre_completo || '').trim() ||
      !String(correo_institucional || '').trim() ||
      !String(telefono || '').trim() ||
      !password ||
      !confirmar_password
    ) {
      throw new AppError('Todos los campos son obligatorios.', 400);
    }

    if (nombre_completo.trim().length > 50) {
      throw new AppError('El nombre completo no puede exceder 50 caracteres.', 400);
    }

    if (!isValidPhone(telefono)) {
      throw new AppError('El teléfono debe tener 10 dígitos.', 400);
    }

    if (!isInstitutionalEmail(correo_institucional)) {
      throw new AppError('El correo debe ser institucional de la UADY (@…uady.mx).', 400);
    }

    if (!(await correoAutorizadoParaRegistro(correo_institucional))) {
      throw new AppError(
        'Este correo no está autorizado para crear una cuenta. Solicita acceso al administrador del SEAP.',
        403
      );
    }

    if (password !== confirmar_password) {
      throw new AppError('La contraseña y la confirmación no coinciden.', 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.errors[0], 400);
    }

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { correo_institucional: normalizeEmail(correo_institucional) },
          { telefono: normalizePhone(telefono) },
        ],
      },
    });

    const uniqueness = validateUniqueCredentials({
      correo_institucional,
      telefono,
      existingUsers: users,
    });

    if (!uniqueness.isValid) {
      throw new AppError(uniqueness.errors[0], 409);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const codigo_verificacion = generateVerificationCode();

    const user = await User.create({
      nombre_completo: nombre_completo.trim(),
      correo_institucional: normalizeEmail(correo_institucional),
      telefono: normalizePhone(telefono),
      password_hash,
      verificado: false,
      codigo_verificacion,
      codigo_expira_en: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      codigo_intentos: 0,
    });

    await sendVerificationEmail({
      to: user.correo_institucional,
      code: codigo_verificacion,
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado correctamente. Debe verificar su cuenta.',
      data: {
        id: user.id,
        correo_institucional: user.correo_institucional,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verificar', limitadores.verificacion, async (req, res, next) => {
  try {
    const { correo_institucional, codigo_verificacion } = req.body;

    if (!correo_institucional || !codigo_verificacion) {
      throw new AppError('Correo y código de verificación son obligatorios.', 400);
    }

    const user = await User.findOne({ where: { correo_institucional: normalizeEmail(correo_institucional) } });

    // Misma respuesta para cuenta inexistente o ya verificada: no se confirma si el correo existe.
    if (!user || user.verificado) {
      throw new AppError('El código de verificación es incorrecto.', 400);
    }

    if (!user.codigo_verificacion) {
      throw new AppError('No hay un código vigente. Solicita uno nuevo.', 400);
    }

    if (isVerificationCodeExpired(user.codigo_expira_en)) {
      throw new AppError('El código de verificación ha expirado. Solicita uno nuevo.', 400);
    }

    if (verifyVerificationCode(codigo_verificacion, user.codigo_verificacion)) {
      user.verificado = true;
      user.codigo_verificacion = null;
      user.codigo_expira_en = null;
      user.codigo_intentos = 0;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Cuenta verificada correctamente.',
      });
    }

    user.codigo_intentos += 1;

    if (user.codigo_intentos >= MAX_VERIFICATION_ATTEMPTS) {
      // Tercer fallo: el código deja de servir y hay que pedir uno nuevo.
      user.codigo_verificacion = null;
      user.codigo_expira_en = null;
      await user.save();

      throw new AppError(
        'Superaste el número de intentos permitidos. Solicita un código nuevo.',
        429,
        null,
        null,
        { intentos_restantes: 0 }
      );
    }

    await user.save();

    throw new AppError('El código de verificación es incorrecto.', 400, null, null, {
      intentos_restantes: MAX_VERIFICATION_ATTEMPTS - user.codigo_intentos,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reenviar-codigo', limitadores.correo, async (req, res, next) => {
  try {
    const { correo_institucional } = req.body;

    if (!correo_institucional) {
      throw new AppError('El correo institucional es obligatorio.', 400);
    }

    if (!isInstitutionalEmail(correo_institucional)) {
      throw new AppError('El correo debe ser institucional de la UADY (@…uady.mx).', 400);
    }

    const user = await User.findOne({ where: { correo_institucional: normalizeEmail(correo_institucional) } });

    if (user && !user.verificado) {
      const codigo_verificacion = generateVerificationCode();
      user.codigo_verificacion = codigo_verificacion;
      user.codigo_expira_en = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
      user.codigo_intentos = 0;
      await user.save();

      await sendVerificationEmail({
        to: user.correo_institucional,
        code: codigo_verificacion,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Si la cuenta está pendiente de verificación, enviamos un código nuevo a tu correo institucional.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', limitadores.login, async (req, res, next) => {
  try {
    const { correo_institucional, password } = req.body;

    if (!correo_institucional || !password) {
      throw new AppError('Correo y contraseña son obligatorios.', 400);
    }

    const user = await User.findOne({
      where: { correo_institucional: normalizeEmail(correo_institucional) },
    });

    if (!user) {
      throw new AppError('Credenciales inválidas.', 401);
    }

    if (!user.verificado) {
      throw new AppError('La cuenta aún no ha sido verificada.', 403);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new AppError('Credenciales inválidas.', 401);
    }

    const token = buildToken(user);
    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      data: { token, expiresIn: '8h' },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login-telefono', limitadores.login, async (req, res, next) => {
  try {
    const { telefono, password } = req.body;

    if (!telefono || !password) {
      throw new AppError('Teléfono y contraseña son obligatorios.', 400);
    }

    const user = await User.findOne({
      where: { telefono: normalizePhone(telefono) },
    });

    if (!user) {
      throw new AppError('Credenciales inválidas.', 401);
    }

    if (!user.verificado) {
      throw new AppError('La cuenta aún no ha sido verificada.', 403);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new AppError('Credenciales inválidas.', 401);
    }

    const token = buildToken(user);
    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      data: { token, expiresIn: '8h' },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user) {
      user.token_version += 1;
      await user.save();
    }

    clearSessionCookie(res);

    res.status(200).json({
      success: true,
      message: 'Sesión cerrada correctamente.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Sesión vigente.',
      data: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        correo_institucional: user.correo_institucional,
        rol: user.rol,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/recuperar', limitadores.correo, async (req, res, next) => {
  try {
    const { correo_institucional } = req.body;

    if (!correo_institucional) {
      throw new AppError('El correo institucional es obligatorio.', 400);
    }

    if (!isInstitutionalEmail(correo_institucional)) {
      throw new AppError('El correo debe ser institucional de la UADY (@…uady.mx).', 400);
    }

    const user = await User.findOne({
      where: { correo_institucional: normalizeEmail(correo_institucional) },
    });

    if (user) {
      const token = generateResetToken();

      // En la base solo se guarda la huella; el token en claro viaja únicamente por correo.
      user.reset_token_hash = hashResetToken(token);
      user.reset_token_expira_en = new Date(Date.now() + RESET_LINK_TTL_MS);
      await user.save();

      await sendResetEmail({ to: user.correo_institucional, token });
    }

    res.status(200).json({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/restablecer', limitadores.verificacion, async (req, res, next) => {
  try {
    const { token, nueva_password, confirmar_password } = req.body;

    if (!token || !nueva_password || !confirmar_password) {
      throw new AppError('Token, nueva contraseña y confirmación son obligatorios.', 400);
    }

    if (nueva_password !== confirmar_password) {
      throw new AppError('La nueva contraseña y la confirmación no coinciden.', 400);
    }

    const passwordValidation = validatePassword(nueva_password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.errors[0], 400);
    }

    const user = await User.findOne({
      where: {
        reset_token_hash: hashResetToken(token),
        reset_token_expira_en: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      throw new AppError('El token de restablecimiento es inválido o ha expirado.', 400);
    }

    user.password_hash = await bcrypt.hash(nueva_password, 10);
    user.reset_token_hash = null;
    user.reset_token_expira_en = null;
    // Invalida todas las sesiones emitidas antes del cambio de contraseña.
    user.token_version += 1;
    await user.save();

    clearSessionCookie(res);

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida correctamente.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
