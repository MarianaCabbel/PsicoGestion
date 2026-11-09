import { describe, expect, it } from 'vitest';
import {
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  checkPassword,
  isInstitutionalEmail,
  isPasswordValid,
  isValidName,
  isValidPhone,
  passwordError,
} from './auth-validation';

describe('auth validation', () => {
  it('validates institutional UADY email addresses', () => {
    expect(isInstitutionalEmail('ana@uady.mx')).toBe(true);
    expect(isInstitutionalEmail('  Ana@CORREO.UADY.MX  ')).toBe(true);
    expect(isInstitutionalEmail('ana@alumni.uady.mx')).toBe(true);
    expect(isInstitutionalEmail('ana@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('ana@xuady.mx')).toBe(false);
    expect(isInstitutionalEmail('no-es-correo')).toBe(false);
  });

  it('validates 10-digit phone numbers ignoring separators', () => {
    expect(isValidPhone('9991234567')).toBe(true);
    expect(isValidPhone('999-123-4567')).toBe(true);
    expect(isValidPhone('99912abcde')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('validates names up to the backend limit', () => {
    expect(isValidName('María López Canul')).toBe(true);
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('a'.repeat(NAME_MAX))).toBe(true);
    expect(isValidName('a'.repeat(NAME_MAX + 1))).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(PASSWORD_MAX).toBe(25);
    expect(isPasswordValid('ClaveSegura1!')).toBe(true);
    expect(checkPassword('Ab1!').length).toBe(false);
    expect(checkPassword('Abcdefg!').number).toBe(false);
    expect(checkPassword('abcde1!fg').uppercase).toBe(false);
    expect(checkPassword('Abcdefg1').special).toBe(false);
    expect(checkPassword(`Aa1!${'a'.repeat(PASSWORD_MAX - 4)}`).length).toBe(true);
    expect(checkPassword(`Aa1!${'a'.repeat(PASSWORD_MAX)}`).length).toBe(false);
  });

  it('returns the first password error in backend order', () => {
    expect(passwordError('Ab1!')).toContain('entre 8 y 25 caracteres');
    expect(passwordError('Abcdefg!')).toContain('un número');
    expect(passwordError('Abcdefg1')).toContain('carácter especial');
    expect(passwordError('abcde1!fg')).toContain('letra mayúscula');
    expect(passwordError('ClaveSegura1!')).toBeNull();
  });
});
