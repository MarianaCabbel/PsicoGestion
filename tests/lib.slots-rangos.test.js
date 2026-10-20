const {
  NUM_SLOTS,
  horaASlot,
  slotAHora,
  horaFinDe,
  slotsDeCita,
  fusionarFranjas,
  diaSemanaISO,
  minutosAHora,
} = require('../src/lib/slots');
const { rangoDeFecha, fechasEntre, sumarDias, diasEntre } = require('../src/lib/rangos');
const reloj = require('../src/lib/reloj');
const { formatearFechaLarga } = require('../src/lib/fechas');
const { estadoEfectivo, filtroPorEstado } = require('../src/modules/citas/citas.estado');
const { sanitizarError } = require('../src/modules/citas/notificaciones.service');
const { formatearFolio } = require('../src/modules/citas/citas.service');
const { normalizarNombre } = require('../src/modules/salas/salas.service');
const { enMerida } = require('./fixtures');

describe('Bloques de 30 minutos', () => {
  test('CP-UNI-40 hay 24 bloques entre 07:00 y 19:00', () => {
    expect(NUM_SLOTS).toBe(24);
  });

  test('CP-UNI-40 convierte hora a bloque y de vuelta', () => {
    expect(horaASlot('07:00')).toBe(0);
    expect(horaASlot('07:30')).toBe(1);
    expect(horaASlot('18:30')).toBe(23);
    expect(slotAHora(0)).toBe('07:00');
    expect(slotAHora(23)).toBe('18:30');
  });

  test('CP-UNI-40 rechaza horas fuera de la ventana o que no son múltiplo de 30', () => {
    expect(horaASlot('06:30')).toBeNull();
    expect(horaASlot('19:00')).toBeNull();
    expect(horaASlot('09:15')).toBeNull();
  });

  test('CP-UNI-41 calcula los bloques que ocupa una cita y su hora de fin', () => {
    expect(slotsDeCita('09:00', 2)).toEqual([4, 5]);
    expect(horaFinDe('09:00', 2)).toBe('10:00');
    expect(slotsDeCita('18:00', 2)).toEqual([22, 23]);
  });

  test('CP-UNI-41 una cita que termina después del cierre no cabe', () => {
    expect(slotsDeCita('18:30', 2)).toBeNull();
    expect(slotsDeCita('09:00', 0)).toBeNull();
    expect(slotsDeCita('09:00', 1.5)).toBeNull();
    expect(slotsDeCita('18:30', 1)).toEqual([23]);
  });

  test('CP-UNI-42 fusiona franjas contiguas y traslapadas', () => {
    expect(
      fusionarFranjas([
        { inicio: 600, fin: 720 },
        { inicio: 480, fin: 600 },
        { inicio: 900, fin: 960 },
        { inicio: 930, fin: 1000 },
      ])
    ).toEqual([
      { inicio: 480, fin: 720 },
      { inicio: 900, fin: 1000 },
    ]);
  });

  test('CP-UNI-42 calcula el día ISO sin depender de la zona del servidor', () => {
    expect(diaSemanaISO('2026-10-19')).toBe(1);
    expect(diaSemanaISO('2026-10-24')).toBe(6);
    expect(diaSemanaISO('2026-10-25')).toBe(7);
    expect(minutosAHora(450)).toBe('07:30');
  });
});

describe('Rangos de fechas', () => {
  test('CP-UNI-43 la semana va de lunes a domingo', () => {
    expect(rangoDeFecha('semana', '2026-10-21')).toEqual({ desde: '2026-10-19', hasta: '2026-10-25' });
    expect(rangoDeFecha('semana', '2026-10-19')).toEqual({ desde: '2026-10-19', hasta: '2026-10-25' });
    expect(rangoDeFecha('semana', '2026-10-25')).toEqual({ desde: '2026-10-19', hasta: '2026-10-25' });
  });

  test('CP-UNI-43 el mes cubre del día 1 al último, incluso en febrero y bisiesto', () => {
    expect(rangoDeFecha('mes', '2026-10-17')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDeFecha('mes', '2027-02-10')).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' });
    expect(rangoDeFecha('mes', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoDeFecha('dia', '2026-10-17')).toEqual({ desde: '2026-10-17', hasta: '2026-10-17' });
  });

  test('CP-UNI-43 la semana cruza el fin de mes y de año', () => {
    expect(rangoDeFecha('semana', '2026-12-31')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' });
  });

  test('CP-UNI-43 enumera fechas y cuenta días', () => {
    expect(fechasEntre('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(diasEntre('2026-10-01', '2026-10-31')).toBe(31);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(() => rangoDeFecha('anio', '2026-10-17')).toThrow(/Rango desconocido/);
  });
});

describe('Reloj y estado de la cita', () => {
  afterEach(() => reloj.fijarAhora(null));

  test('CP-UNI-44 el reloj fijado devuelve fecha y hora de Mérida', () => {
    reloj.fijarAhora(enMerida('2026-10-19', '10:45'));

    expect(reloj.enClinica()).toEqual({ fecha: '2026-10-19', hora: '10:45', minutos: 645 });
  });

  test('CP-UNI-44 fijarAhora solo se permite en pruebas', () => {
    const previo = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      expect(() => reloj.fijarAhora(new Date())).toThrow(/solo puede usarse en el entorno de pruebas/);
    } finally {
      process.env.NODE_ENV = previo;
    }
  });

  test('CP-UNI-45 una cita pendiente pasa a vencida cuando termina su hora de fin', () => {
    const cita = { estado: 'pendiente', fecha: '2026-10-19', hora_fin: '10:00' };

    expect(estadoEfectivo(cita, { fecha: '2026-10-19', hora: '09:59' })).toBe('pendiente');
    expect(estadoEfectivo(cita, { fecha: '2026-10-19', hora: '10:00' })).toBe('vencida');
    expect(estadoEfectivo(cita, { fecha: '2026-10-20', hora: '07:00' })).toBe('vencida');
    expect(estadoEfectivo(cita, { fecha: '2026-10-18', hora: '23:59' })).toBe('pendiente');
  });

  test('CP-UNI-45 una cita cancelada nunca se considera vencida', () => {
    const cita = { estado: 'cancelada', fecha: '2020-01-01', hora_fin: '10:00' };
    expect(estadoEfectivo(cita, { fecha: '2026-10-19', hora: '12:00' })).toBe('cancelada');
  });

  test('CP-UNI-45 el filtro "todas" no agrega condiciones', () => {
    expect(filtroPorEstado('todas', { fecha: '2026-10-19', hora: '10:00' })).toEqual({});
  });
});

describe('Utilidades de salas, folios y correo', () => {
  test('CP-UNI-46 el folio lleva año y consecutivo de 6 dígitos', () => {
    expect(formatearFolio(2026, 1)).toBe('CIT-2026-000001');
    expect(formatearFolio(2026, 123456)).toBe('CIT-2026-123456');
  });

  test('CP-UNI-46 el nombre de sala se normaliza sin acentos, mayúsculas ni espacios dobles', () => {
    expect(normalizarNombre('  Sála   Ñandú ')).toBe('sala nandu');
    expect(normalizarNombre('SALA A')).toBe(normalizarNombre('sala  a'));
  });

  test('CP-UNI-47 la fecha larga se escribe en español de México', () => {
    expect(formatearFechaLarga('2026-10-20')).toBe('martes, 20 de octubre de 2026');
  });

  test('CP-UNI-47 los errores guardados no conservan correos electrónicos', () => {
    expect(sanitizarError('550 5.1.1 <ana@correo.com>: user unknown')).toBe('550 5.1.1 <[correo]>: user unknown');
    expect(sanitizarError(`${'x'.repeat(400)}`)).toHaveLength(255);
    expect(sanitizarError(undefined)).toBe('Error desconocido');
  });
});
