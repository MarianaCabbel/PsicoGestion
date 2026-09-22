const Joi = require('joi');

const passwordSchema = Joi.string()
  .min(8)
  .max(25)
  .pattern(/(?=.*\d)(?=.*[A-Z])(?=.*[^A-Za-z0-9])/)
  .required();

function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8 || password.length > 25) {
    errors.push('La contraseña debe tener entre 8 y 25 caracteres.');
  }

  if (!/(?=.*\d)/.test(password || '')) {
    errors.push('La contraseña debe incluir al menos un número.');
  }

  if (!/(?=.*[^A-Za-z0-9])/.test(password || '')) {
    errors.push('La contraseña debe incluir al menos un carácter especial.');
  }

  if (!/(?=.*[A-Z])/.test(password || '')) {
    errors.push('La contraseña debe incluir al menos una letra mayúscula.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: password,
  };
}

function validateUniqueCredentials({ correo_institucional, telefono, existingUsers = [] }) {
  const errors = [];
  const normalizedEmail = String(correo_institucional || '').trim().toLowerCase();
  const normalizedPhone = String(telefono || '').trim();

  const emailExists = existingUsers.some(
    (user) => String(user.correo_institucional || '').trim().toLowerCase() === normalizedEmail
  );

  const phoneExists = existingUsers.some(
    (user) => String(user.telefono || '').trim() === normalizedPhone
  );

  if (emailExists) {
    errors.push('El correo institucional ya está registrado.');
  }

  if (phoneExists) {
    errors.push('El teléfono ya está registrado.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function verifyVerificationCode(inputCode, storedCode) {
  return String(inputCode || '').trim() === String(storedCode || '').trim();
}

function generateResetToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  passwordSchema,
  validatePassword,
  validateUniqueCredentials,
  generateVerificationCode,
  verifyVerificationCode,
  generateResetToken,
};
