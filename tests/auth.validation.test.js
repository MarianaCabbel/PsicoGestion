const {
  VERIFICATION_CODE_TTL_MS,
  RESET_LINK_TTL_MS,
  isInstitutionalEmail,
  isValidPhone,
  isVerificationCodeExpired,
  generateResetToken,
  validatePassword,
  validateUniqueCredentials,
  generateVerificationCode,
  verifyVerificationCode,
} = require('../src/utils/authHelpers');

describe('Validación de contraseña', () => {
  test('rechaza contraseñas con menos de 8 caracteres', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La contraseña debe tener entre 8 y 25 caracteres.');
  });

  test('rechaza contraseñas sin número', () => {
    const result = validatePassword('Abcdefg!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La contraseña debe incluir al menos un número.');
  });

  test('rechaza contraseñas sin carácter especial', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La contraseña debe incluir al menos un carácter especial.');
  });

  test('rechaza contraseñas sin mayúscula', () => {
    const result = validatePassword('abcde1!fg');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La contraseña debe incluir al menos una letra mayúscula.');
  });

  test('acepta contraseñas válidas', () => {
    const result = validatePassword('ClaveSegura1!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('Unicidad de correo y teléfono', () => {
  test('rechaza cuando el correo ya existe', () => {
    const result = validateUniqueCredentials({
      correo_institucional: 'ana@correo.uady.mx',
      telefono: '9876543210',
      existingUsers: [{ correo_institucional: 'ana@correo.uady.mx', telefono: '1111111111' }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El correo institucional ya está registrado.');
  });

  test('rechaza cuando el teléfono ya existe', () => {
    const result = validateUniqueCredentials({
      correo_institucional: 'nuevo@correo.uady.mx',
      telefono: '9876543210',
      existingUsers: [{ correo_institucional: 'otro@correo.uady.mx', telefono: '9876543210' }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El teléfono ya está registrado.');
  });

  test('acepta valores únicos', () => {
    const result = validateUniqueCredentials({
      correo_institucional: 'nuevo@correo.uady.mx',
      telefono: '9876543210',
      existingUsers: [{ correo_institucional: 'otro@correo.uady.mx', telefono: '1234567890' }],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('normaliza mayúsculas y espacios antes de comparar', () => {
    const result = validateUniqueCredentials({
      correo_institucional: '  ANA@CORREO.UADY.MX ',
      telefono: '987-654-3210',
      existingUsers: [{ correo_institucional: 'ana@correo.uady.mx', telefono: '9876543210' }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('Generación y verificación de código', () => {
  test('genera un código de seis dígitos', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('verifica un código correcto', () => {
    expect(verifyVerificationCode('123456', '123456')).toBe(true);
  });

  test('rechaza un código incorrecto', () => {
    expect(verifyVerificationCode('123456', '654321')).toBe(false);
  });
});

describe('Validación de correo institucional y teléfono', () => {
  test('acepta cualquier subdominio de uady.mx', () => {
    expect(isInstitutionalEmail('ana@uady.mx')).toBe(true);
    expect(isInstitutionalEmail('ana@correo.uady.mx')).toBe(true);
    expect(isInstitutionalEmail('  ANA@CORREO.UADY.MX  ')).toBe(true);
  });

  test('rechaza dominios ajenos y correos malformados', () => {
    expect(isInstitutionalEmail('ana@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('ana@psicogestion.com')).toBe(false);
    expect(isInstitutionalEmail('ana@xuady.mx')).toBe(false);
    expect(isInstitutionalEmail('no-es-correo')).toBe(false);
    expect(isInstitutionalEmail('')).toBe(false);
    expect(isInstitutionalEmail(undefined)).toBe(false);
  });

  test('acepta exactamente 10 dígitos y normaliza la puntuación', () => {
    expect(isValidPhone('9991234567')).toBe(true);
    expect(isValidPhone('999-123-4567')).toBe(true);
    expect(isValidPhone('(999) 123 4567')).toBe(true);
    expect(isValidPhone('999123456')).toBe(false);
    expect(isValidPhone('99912345678')).toBe(false);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('abcdefghij')).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });
});

describe('Caducidad de códigos y enlaces', () => {
  test('los periodos de vigencia son de 10 minutos', () => {
    expect(VERIFICATION_CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(RESET_LINK_TTL_MS).toBe(10 * 60 * 1000);
  });

  test('detecta códigos y enlaces ya vencidos', () => {
    expect(isVerificationCodeExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isVerificationCodeExpired(new Date(Date.now() - 1))).toBe(true);
  });

  test('acepta los que aún están vigentes', () => {
    expect(isVerificationCodeExpired(new Date(Date.now() + 60000))).toBe(false);
    expect(isVerificationCodeExpired(null)).toBe(false);
    expect(isVerificationCodeExpired(undefined)).toBe(false);
  });
});

describe('Generación de token de restablecimiento', () => {
  test('genera un token hexadecimal de 64 caracteres', () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test('cada token es distinto', () => {
    expect(generateResetToken()).not.toBe(generateResetToken());
  });
});
