export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 25;

export type PasswordChecks = {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
};

/** Reglas equivalentes a `validatePassword` del backend. */
export function checkPassword(value: string): PasswordChecks {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

export function isPasswordValid(value: string): boolean {
  const checks = checkPassword(value);
  return checks.length && checks.uppercase && checks.number && checks.special;
}

/** Primer error de contraseña, en el mismo orden que el backend. */
export function passwordError(value: string): string | null {
  const checks = checkPassword(value);
  if (!checks.length) return `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`;
  if (!checks.number) return 'La contraseña debe incluir al menos un número.';
  if (!checks.special) return 'La contraseña debe incluir al menos un carácter especial.';
  if (!checks.uppercase) return 'La contraseña debe incluir al menos una letra mayúscula.';
  return null;
}

/** Correo institucional UADY: cualquier subdominio que termine en uady.mx. */
export function isInstitutionalEmail(value: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*uady\.mx$/i.test(value.trim());
}

/** Teléfono de 10 dígitos (formato nacional). */
export function isValidPhone(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/\D/g, ''));
}

/** Nombre no vacío y dentro del límite del backend. */
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX;
}
