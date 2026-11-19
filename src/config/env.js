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
  } catch (_error) {
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
 * Convierte un patrón de origen con comodín `*` en una expresión anclada.
 * El comodín solo admite caracteres válidos en un hostname, para que un patrón
 * acotado a un proyecto no pueda terminar aceptando dominios ajenos.
 */
function patronComoExpresion(patron) {
  const escapado = String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapado.replace(/\\\*/g, '[a-z0-9-]*')}$`, 'i');
}

/**
 * Patrones de origen para despliegues con URL variable (por ejemplo los
 * previews de Vercel, cuyo hash cambia en cada deploy). Se configuran en
 * CORS_ORIGIN_PATTERNS, separados por coma.
 */
function getAllowedOriginPatterns() {
  return splitList(process.env.CORS_ORIGIN_PATTERNS).map(patronComoExpresion);
}

/** Comprueba un origen contra la lista exacta y contra los patrones configurados. */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (getAllowedOrigins().includes(origin)) return true;
  return getAllowedOriginPatterns().some((patron) => patron.test(origin));
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

/**
 * Transporte de correo:
 *  - "api": HTTPS a Brevo (necesario en Render free, donde los puertos SMTP están bloqueados).
 *  - "smtp": nodemailer para desarrollo y pruebas.
 */
function getEmailTransport() {
  const configured = String(process.env.EMAIL_TRANSPORT || '').trim().toLowerCase();
  if (configured === 'api' || configured === 'smtp') return configured;
  return isProduction() ? 'api' : 'smtp';
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
    if (getEmailTransport() === 'api') {
      if (!process.env.BREVO_API_KEY) {
        throw new Error('Define BREVO_API_KEY en producción para enviar correos.');
      }
      if (!process.env.EMAIL_FROM) {
        throw new Error('Define EMAIL_FROM (correo verificado en Brevo) en producción.');
      }
    } else if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Define SMTP_USER y SMTP_PASS en producción para enviar correos.');
    }
  }
}

module.exports = {
  isProduction,
  getJwtSecret,
  getAllowedOrigins,
  getAllowedOriginPatterns,
  isAllowedOrigin,
  getRegistroModo,
  getEmailTransport,
  getExtraInstitutionalDomains,
  getTrustProxy,
  assertEnvironment,
};
