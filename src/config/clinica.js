/**
 * Parámetros de operación de la clínica. Están aquí (y no dispersos en el
 * código) porque varios son decisiones pendientes del SEAP (B-1, B-5) y deben
 * poder cambiarse en un solo lugar.
 */
module.exports = {
  ZONA_HORARIA: 'America/Merida',
  SLOT_MINUTOS: 30,
  HORA_INICIO: '07:00',
  HORA_FIN: '19:00',
  /** 1 = lunes … 7 = domingo. */
  DIAS_ATENCION: [1, 2, 3, 4, 5],
  EDAD_MINIMA_PACIENTE: 7,
  EDAD_MAXIMA: 120,
  EDAD_MINIMA_TERAPEUTA: 21,
  AVISO_PRIVACIDAD_VERSION: 'v1.0',
  FOTO_MIN_PX: 200,
  FOTO_SALIDA_PX: 256,
  FOTO_MAX_BYTES: 2 * 1024 * 1024,
  /** Duración por defecto de una cita en bloques de SLOT_MINUTOS (decisión B-1: 2 = 60 min). */
  DURACION_CITA_SLOTS_DEFECTO: 2,
  DURACION_CITA_SLOTS_MAXIMA: 4,
  /** Si es true, solo se agenda dentro de los horarios semanales configurados del terapeuta. */
  REQUIERE_HORARIO_TERAPEUTA: true,
  SALA_NOMBRE_MAXIMO: 10,
  /** Rango máximo (en días) que se puede consultar en la disponibilidad mensual de una sala. */
  DISPONIBILIDAD_MAX_DIAS: 62,
  PAGINA_LIMITE_MAXIMO: 100,
  PAGINA_LIMITE_DEFECTO: 20,
};
