const {
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
      correo_institucional: 'ana@psicogestion.com',
      telefono: '987654321',
      existingUsers: [{ correo_institucional: 'ana@psicogestion.com', telefono: '111111111' }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El correo institucional ya está registrado.');
  });

  test('rechaza cuando el teléfono ya existe', () => {
    const result = validateUniqueCredentials({
      correo_institucional: 'nuevo@psicogestion.com',
      telefono: '987654321',
      existingUsers: [{ correo_institucional: 'otro@psicogestion.com', telefono: '987654321' }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El teléfono ya está registrado.');
  });

  test('acepta valores únicos', () => {
    const result = validateUniqueCredentials({
      correo_institucional: 'nuevo@psicogestion.com',
      telefono: '987654321',
      existingUsers: [{ correo_institucional: 'otro@psicogestion.com', telefono: '123456789' }],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
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
