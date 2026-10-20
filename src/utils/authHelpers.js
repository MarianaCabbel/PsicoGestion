const crypto = require('crypto');
const { getExtraInstitutionalDomains } = require('../config/env');

/** Intentos fallidos permitidos por código de verificación antes de invalidarlo. */
const MAX_VERIFICATION_ATTEMPTS = 3;

/** Vida del código de verificación enviado por correo (CP-UNI-08). */
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

/** Vida del enlace de restablecimiento de contraseña (CP-UNI-27). */
const RESET_LINK_TTL_MS = 10 * 60 * 1000;

/**
 * Correo institucional: cualquier subdominio que termine en uady.mx, o un dominio
 * adicional autorizado en DOMINIOS_INSTITUCIONALES_EXTRA.
 */
function isInstitutionalEmail(value) {
  const email = String(value || '').trim();

  if (/^[^\s@]+@([a-z0-9-]+\.)*uady\.mx$/i.test(email)) {
    return true;
  }

  const domain = email.split('@')[1];
  if (!domain || email.split('@').length !== 2 || /\s/.test(email)) {
    return false;
  }

  return getExtraInstitutionalDomains().includes(domain.toLowerCase());
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Teléfono de 10 dígitos, ignorando la puntuación de separación. */
function isValidPhone(value) {
  return /^\d{10}$/.test(normalizePhone(value));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

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
  const normalizedEmail = normalizeEmail(correo_institucional);
  const normalizedPhone = normalizePhone(telefono);

  const emailExists = existingUsers.some(
    (user) => normalizeEmail(user.correo_institucional) === normalizedEmail
  );

  const phoneExists = existingUsers.some(
    (user) => normalizePhone(user.telefono) === normalizedPhone
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

/** Código de 6 dígitos con generador criptográfico (no Math.random). */
function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Comparación en tiempo constante para no filtrar información por temporización. */
function verifyVerificationCode(inputCode, storedCode) {
  const input = Buffer.from(String(inputCode || '').trim());
  const stored = Buffer.from(String(storedCode || '').trim());

  if (input.length === 0 || input.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(input, stored);
}

function isVerificationCodeExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() <= Date.now();
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Huella SHA-256 del token de recuperación. Solo la huella se guarda en la base
 * de datos: el token es de 256 bits aleatorios, por lo que un hash rápido es
 * suficiente (no hay diccionario que atacar) y permite buscar por igualdad.
 */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

module.exports = {
  MAX_VERIFICATION_ATTEMPTS,
  hashResetToken,
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
};
