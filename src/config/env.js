/**
 * Lectura centralizada de variables de entorno sensibles.
 * Todo lo que cambia entre desarrollo y producción pasa por aquí para que
 * un error de configuración haga fallar el arranque y no el primer usuario.
 */

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (isProduction()) {
    throw new Error('JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.');
  }

  return secret || 'dev-secret';
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
}

/** Orígenes del frontend autorizados para CORS y para peticiones con cookie. */
function getAllowedOrigins() {
  const origins = new Set(splitList(process.env.CORS_ORIGINS));
  const appOrigin = originOf(process.env.APP_URL);

  if (appOrigin) origins.add(appOrigin);
  if (!isProduction() && origins.size === 0) origins.add('http://localhost:3000');

  return [...origins];
}

/**
 * Política de registro de cuentas:
 *  - "lista_blanca": solo correos dados de alta en correos_autorizados (producción).
 *  - "dominio": basta con un correo institucional válido (desarrollo y pruebas).
 */
function getRegistroModo() {
  const configured = String(process.env.REGISTRO_MODO || '').trim().toLowerCase();

  if (configured === 'lista_blanca' || configured === 'dominio') {
    return configured;
  }

  return isProduction() ? 'lista_blanca' : 'dominio';
}

/** Dominios institucionales adicionales a uady.mx (separados por coma). */
function getExtraInstitutionalDomains() {
  return splitList(process.env.DOMINIOS_INSTITUCIONALES_EXTRA).map((domain) => domain.toLowerCase());
}

function getTrustProxy() {
  const value = process.env.TRUST_PROXY;
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** Falla al arrancar si la configuración de producción es insegura. */
function assertEnvironment() {
  getJwtSecret();

  if (isProduction()) {
    if (getAllowedOrigins().length === 0) {
      throw new Error('Define APP_URL o CORS_ORIGINS en producción.');
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Define SMTP_USER y SMTP_PASS en producción para enviar correos.');
    }
  }
}

module.exports = {
  isProduction,
  getJwtSecret,
  getAllowedOrigins,
  getRegistroModo,
  getExtraInstitutionalDomains,
  getTrustProxy,
  assertEnvironment,
};
