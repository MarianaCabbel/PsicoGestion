const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../config/database');
const { AppError } = require('../utils/errors');
const { validatePassword, validateUniqueCredentials, generateVerificationCode, verifyVerificationCode, generateResetToken } = require('../utils/authHelpers');
const { sendVerificationEmail, sendResetEmail } = require('../utils/email');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

function buildToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
}

router.post('/registro', async (req, res, next) => {
  try {
    const { nombre_completo, correo_institucional, telefono, password, confirmar_password } = req.body;

    if (!nombre_completo || !correo_institucional || !telefono || !password || !confirmar_password) {
      throw new AppError('Todos los campos son obligatorios.', 400);
    }

    if (nombre_completo.trim().length > 50) {
      throw new AppError('El nombre completo no puede exceder 50 caracteres.', 400);
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
          { correo_institucional: correo_institucional.trim().toLowerCase() },
          { telefono: String(telefono).trim() },
        ],
      },
    });

    const uniqueness = validateUniqueCredentials({
      correo_institucional: correo_institucional.trim().toLowerCase(),
      telefono: String(telefono).trim(),
      existingUsers: users,
    });

    if (!uniqueness.isValid) {
      throw new AppError(uniqueness.errors[0], 409);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const codigo_verificacion = generateVerificationCode();

    const user = await User.create({
      nombre_completo: nombre_completo.trim(),
      correo_institucional: correo_institucional.trim().toLowerCase(),
      telefono: String(telefono).trim(),
      password_hash,
      verificado: false,
      codigo_verificacion,
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

router.post('/verificar', async (req, res, next) => {
  try {
    const { correo_institucional, codigo_verificacion } = req.body;

    if (!correo_institucional || !codigo_verificacion) {
      throw new AppError('Correo y código de verificación son obligatorios.', 400);
    }

    const user = await User.findOne({ where: { correo_institucional: String(correo_institucional).trim().toLowerCase() } });

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    if (verifyVerificationCode(codigo_verificacion, user.codigo_verificacion)) {
      user.verificado = true;
      user.codigo_verificacion = null;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Cuenta verificada correctamente.',
      });
    }

    throw new AppError('El código de verificación es incorrecto.', 400);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { correo_institucional, password } = req.body;

    if (!correo_institucional || !password) {
      throw new AppError('Correo y contraseña son obligatorios.', 400);
    }

    const user = await User.findOne({
      where: { correo_institucional: String(correo_institucional).trim().toLowerCase() },
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

    const token = buildToken({ id: user.id, correo_institucional: user.correo_institucional });

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      data: { token, expiresIn: '8h' },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Sesión cerrada correctamente.',
  });
});

router.post('/recuperar', async (req, res, next) => {
  try {
    const { correo_institucional } = req.body;

    if (!correo_institucional) {
      throw new AppError('El correo institucional es obligatorio.', 400);
    }

    const user = await User.findOne({
      where: { correo_institucional: String(correo_institucional).trim().toLowerCase() },
    });

    if (!user) {
      throw new AppError('No se encontró un usuario con ese correo.', 404);
    }

    const token = generateResetToken();
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.reset_token_hash = token;
    user.reset_token_expira_en = tokenExpiry;
    await user.save();

    await sendResetEmail({ to: user.correo_institucional, token });

    res.status(200).json({
      success: true,
      message: 'Se envió un enlace de recuperación a tu correo.',
      data: { token },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/restablecer', async (req, res, next) => {
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
        reset_token_hash: token,
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
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida correctamente.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
