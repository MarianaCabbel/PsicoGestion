const { isProduction } = require('../config/env');

const SESSION_COOKIE = 'pg_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function parseCookies(header) {
  const cookies = {};

  String(header || '')
    .split(';')
    .forEach((part) => {
      const index = part.indexOf('=');
      if (index === -1) return;

      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();

      if (!name) return;

      try {
        cookies[name] = decodeURIComponent(value);
      } catch (error) {
        cookies[name] = value;
      }
    });

  return cookies;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  };
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

module.exports = { SESSION_COOKIE, parseCookies, setSessionCookie, clearSessionCookie };
